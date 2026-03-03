use std::collections::HashMap;
use std::sync::Arc;

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::postgres::PgPoolOptions;
use sqlx::{Pool, Postgres, Row};
use thiserror::Error;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::domain::models::{ApprovalRecord, ApprovalState};
use crate::infra::attestation::DsseEnvelope;

static MIGRATOR: sqlx::migrate::Migrator = sqlx::migrate!();

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EventRecord {
    pub id: Uuid,
    pub trace_id: String,
    pub tenant_slug: String,
    pub event_type: String,
    pub created_at: DateTime<Utc>,
    pub payload: Value,
}

#[derive(Debug, Error)]
pub enum StoreError {
    #[error("store operation failed: {0}")]
    Operation(String),
}

#[async_trait]
pub trait EventStore: Send + Sync {
    async fn append_event(&self, event: EventRecord) -> Result<(), StoreError>;
    async fn events_by_trace(&self, trace_id: &str) -> Result<Vec<EventRecord>, StoreError>;
    async fn set_kill_switch(
        &self,
        tenant_slug: &str,
        tool_name: Option<&str>,
        disabled: bool,
    ) -> Result<Vec<String>, StoreError>;
    async fn is_tool_disabled(
        &self,
        tenant_slug: &str,
        tool_name: &str,
    ) -> Result<bool, StoreError>;
    async fn reserve_replay_token(
        &self,
        token: &str,
        expires_at: DateTime<Utc>,
    ) -> Result<bool, StoreError>;
    async fn upsert_approval(&self, approval: ApprovalRecord) -> Result<(), StoreError>;
    async fn get_approval(&self, approval_id: Uuid) -> Result<Option<ApprovalRecord>, StoreError>;
    async fn put_attestation(&self, envelope: DsseEnvelope) -> Result<(), StoreError>;
    async fn get_attestation(
        &self,
        attestation_id: &str,
    ) -> Result<Option<DsseEnvelope>, StoreError>;
}

#[derive(Default)]
struct InMemoryState {
    events: Vec<EventRecord>,
    tenant_kill_switch: HashMap<String, bool>,
    tool_kill_switch: HashMap<(String, String), bool>,
    replay_tokens: HashMap<String, DateTime<Utc>>,
    approvals: HashMap<Uuid, ApprovalRecord>,
    attestations: HashMap<String, DsseEnvelope>,
}

#[derive(Clone, Default)]
pub struct InMemoryEventStore {
    state: Arc<RwLock<InMemoryState>>,
}

#[async_trait]
impl EventStore for InMemoryEventStore {
    async fn append_event(&self, event: EventRecord) -> Result<(), StoreError> {
        let mut state = self.state.write().await;
        state.events.push(event);
        Ok(())
    }

    async fn events_by_trace(&self, trace_id: &str) -> Result<Vec<EventRecord>, StoreError> {
        let state = self.state.read().await;
        Ok(state
            .events
            .iter()
            .filter(|event| event.trace_id == trace_id)
            .cloned()
            .collect())
    }

    async fn set_kill_switch(
        &self,
        tenant_slug: &str,
        tool_name: Option<&str>,
        disabled: bool,
    ) -> Result<Vec<String>, StoreError> {
        let mut state = self.state.write().await;

        let affected = if let Some(tool_name) = tool_name {
            state
                .tool_kill_switch
                .insert((tenant_slug.to_string(), tool_name.to_string()), disabled);
            vec![tool_name.to_string()]
        } else {
            state
                .tenant_kill_switch
                .insert(tenant_slug.to_string(), disabled);
            vec!["*".to_string()]
        };

        Ok(affected)
    }

    async fn is_tool_disabled(
        &self,
        tenant_slug: &str,
        tool_name: &str,
    ) -> Result<bool, StoreError> {
        let state = self.state.read().await;

        if state
            .tenant_kill_switch
            .get(tenant_slug)
            .copied()
            .unwrap_or(false)
        {
            return Ok(true);
        }

        Ok(state
            .tool_kill_switch
            .get(&(tenant_slug.to_string(), tool_name.to_string()))
            .copied()
            .unwrap_or(false))
    }

    async fn reserve_replay_token(
        &self,
        token: &str,
        expires_at: DateTime<Utc>,
    ) -> Result<bool, StoreError> {
        let mut state = self.state.write().await;
        let now = Utc::now();

        state.replay_tokens.retain(|_, expiry| *expiry > now);

        if state.replay_tokens.contains_key(token) {
            return Ok(false);
        }

        state.replay_tokens.insert(token.to_string(), expires_at);
        Ok(true)
    }

    async fn upsert_approval(&self, approval: ApprovalRecord) -> Result<(), StoreError> {
        let mut state = self.state.write().await;
        state.approvals.insert(approval.approval_id, approval);
        Ok(())
    }

    async fn get_approval(&self, approval_id: Uuid) -> Result<Option<ApprovalRecord>, StoreError> {
        let mut state = self.state.write().await;
        if let Some(approval) = state.approvals.get_mut(&approval_id) {
            if approval.state == ApprovalState::Pending && approval.expires_at <= Utc::now() {
                approval.state = ApprovalState::Expired;
                approval.resolved_at = Some(Utc::now());
            }
        }

        Ok(state.approvals.get(&approval_id).cloned())
    }

    async fn put_attestation(&self, envelope: DsseEnvelope) -> Result<(), StoreError> {
        let mut state = self.state.write().await;
        state
            .attestations
            .insert(envelope.attestation_id.clone(), envelope);
        Ok(())
    }

    async fn get_attestation(
        &self,
        attestation_id: &str,
    ) -> Result<Option<DsseEnvelope>, StoreError> {
        let state = self.state.read().await;
        Ok(state.attestations.get(attestation_id).cloned())
    }
}

#[derive(Clone)]
pub struct PgEventStore {
    pool: Pool<Postgres>,
}

impl PgEventStore {
    pub async fn connect(database_url: &str, run_migrations: bool) -> Result<Self, StoreError> {
        let pool = PgPoolOptions::new()
            .max_connections(12)
            .connect(database_url)
            .await
            .map_err(|error| StoreError::Operation(format!("postgres connect failed: {error}")))?;

        if run_migrations {
            MIGRATOR.run(&pool).await.map_err(|error| {
                StoreError::Operation(format!("postgres migration failed: {error}"))
            })?;
        }

        Ok(Self { pool })
    }
}

#[async_trait]
impl EventStore for PgEventStore {
    async fn append_event(&self, event: EventRecord) -> Result<(), StoreError> {
        sqlx::query(
            r#"
            INSERT INTO v2_events (id, trace_id, tenant_slug, event_type, created_at, payload)
            VALUES ($1, $2, $3, $4, $5, $6)
            "#,
        )
        .bind(event.id)
        .bind(event.trace_id)
        .bind(event.tenant_slug)
        .bind(event.event_type)
        .bind(event.created_at)
        .bind(event.payload)
        .execute(&self.pool)
        .await
        .map_err(|error| StoreError::Operation(format!("append event failed: {error}")))?;

        Ok(())
    }

    async fn events_by_trace(&self, trace_id: &str) -> Result<Vec<EventRecord>, StoreError> {
        let rows = sqlx::query(
            r#"
            SELECT id, trace_id, tenant_slug, event_type, created_at, payload
            FROM v2_events
            WHERE trace_id = $1
            ORDER BY created_at ASC
            "#,
        )
        .bind(trace_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|error| StoreError::Operation(format!("query events failed: {error}")))?;

        rows.into_iter()
            .map(|row| {
                Ok(EventRecord {
                    id: row.try_get("id").map_err(db_decode_err)?,
                    trace_id: row.try_get("trace_id").map_err(db_decode_err)?,
                    tenant_slug: row.try_get("tenant_slug").map_err(db_decode_err)?,
                    event_type: row.try_get("event_type").map_err(db_decode_err)?,
                    created_at: row.try_get("created_at").map_err(db_decode_err)?,
                    payload: row.try_get("payload").map_err(db_decode_err)?,
                })
            })
            .collect()
    }

    async fn set_kill_switch(
        &self,
        tenant_slug: &str,
        tool_name: Option<&str>,
        disabled: bool,
    ) -> Result<Vec<String>, StoreError> {
        let now = Utc::now();
        if let Some(tool_name) = tool_name {
            sqlx::query(
                r#"
                INSERT INTO v2_tool_kill_switches (tenant_slug, tool_name, disabled, updated_at)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (tenant_slug, tool_name)
                DO UPDATE SET disabled = EXCLUDED.disabled, updated_at = EXCLUDED.updated_at
                "#,
            )
            .bind(tenant_slug)
            .bind(tool_name)
            .bind(disabled)
            .bind(now)
            .execute(&self.pool)
            .await
            .map_err(|error| {
                StoreError::Operation(format!("set tool kill switch failed: {error}"))
            })?;
            return Ok(vec![tool_name.to_string()]);
        }

        sqlx::query(
            r#"
            INSERT INTO v2_tenant_kill_switches (tenant_slug, disabled, updated_at)
            VALUES ($1, $2, $3)
            ON CONFLICT (tenant_slug)
            DO UPDATE SET disabled = EXCLUDED.disabled, updated_at = EXCLUDED.updated_at
            "#,
        )
        .bind(tenant_slug)
        .bind(disabled)
        .bind(now)
        .execute(&self.pool)
        .await
        .map_err(|error| {
            StoreError::Operation(format!("set tenant kill switch failed: {error}"))
        })?;

        Ok(vec!["*".to_string()])
    }

    async fn is_tool_disabled(
        &self,
        tenant_slug: &str,
        tool_name: &str,
    ) -> Result<bool, StoreError> {
        let tenant_disabled: Option<bool> = sqlx::query_scalar(
            r#"
            SELECT disabled
            FROM v2_tenant_kill_switches
            WHERE tenant_slug = $1
            "#,
        )
        .bind(tenant_slug)
        .fetch_optional(&self.pool)
        .await
        .map_err(|error| {
            StoreError::Operation(format!("query tenant kill switch failed: {error}"))
        })?;

        if tenant_disabled.unwrap_or(false) {
            return Ok(true);
        }

        let tool_disabled: Option<bool> = sqlx::query_scalar(
            r#"
            SELECT disabled
            FROM v2_tool_kill_switches
            WHERE tenant_slug = $1 AND tool_name = $2
            "#,
        )
        .bind(tenant_slug)
        .bind(tool_name)
        .fetch_optional(&self.pool)
        .await
        .map_err(|error| {
            StoreError::Operation(format!("query tool kill switch failed: {error}"))
        })?;

        Ok(tool_disabled.unwrap_or(false))
    }

    async fn reserve_replay_token(
        &self,
        token: &str,
        expires_at: DateTime<Utc>,
    ) -> Result<bool, StoreError> {
        let mut tx = self.pool.begin().await.map_err(|error| {
            StoreError::Operation(format!("begin replay transaction failed: {error}"))
        })?;

        sqlx::query("DELETE FROM v2_replay_tokens WHERE expires_at <= NOW()")
            .execute(&mut *tx)
            .await
            .map_err(|error| {
                StoreError::Operation(format!("replay token cleanup failed: {error}"))
            })?;

        let inserted: Option<String> = sqlx::query_scalar(
            r#"
            INSERT INTO v2_replay_tokens (token, expires_at)
            VALUES ($1, $2)
            ON CONFLICT (token) DO NOTHING
            RETURNING token
            "#,
        )
        .bind(token)
        .bind(expires_at)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|error| StoreError::Operation(format!("reserve replay token failed: {error}")))?;

        tx.commit().await.map_err(|error| {
            StoreError::Operation(format!("commit replay transaction failed: {error}"))
        })?;

        Ok(inserted.is_some())
    }

    async fn upsert_approval(&self, approval: ApprovalRecord) -> Result<(), StoreError> {
        sqlx::query(
            r#"
            INSERT INTO v2_approvals (
                approval_id,
                tenant_slug,
                trace_id,
                decision_id,
                state,
                reason,
                requested_by,
                resolved_by,
                note,
                created_at,
                expires_at,
                resolved_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (approval_id)
            DO UPDATE SET
                state = EXCLUDED.state,
                resolved_by = EXCLUDED.resolved_by,
                note = EXCLUDED.note,
                expires_at = EXCLUDED.expires_at,
                resolved_at = EXCLUDED.resolved_at
            "#,
        )
        .bind(approval.approval_id)
        .bind(approval.tenant_slug)
        .bind(approval.trace_id)
        .bind(approval.decision_id)
        .bind(approval_state_to_db(&approval.state))
        .bind(approval.reason)
        .bind(approval.requested_by)
        .bind(approval.resolved_by)
        .bind(approval.note)
        .bind(approval.created_at)
        .bind(approval.expires_at)
        .bind(approval.resolved_at)
        .execute(&self.pool)
        .await
        .map_err(|error| StoreError::Operation(format!("upsert approval failed: {error}")))?;

        Ok(())
    }

    async fn get_approval(&self, approval_id: Uuid) -> Result<Option<ApprovalRecord>, StoreError> {
        let row = sqlx::query(
            r#"
            SELECT approval_id, tenant_slug, trace_id, decision_id, state, reason, requested_by,
                   resolved_by, note, created_at, expires_at, resolved_at
            FROM v2_approvals
            WHERE approval_id = $1
            "#,
        )
        .bind(approval_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|error| StoreError::Operation(format!("get approval failed: {error}")))?;

        let Some(row) = row else {
            return Ok(None);
        };

        let mut approval = ApprovalRecord {
            approval_id: row.try_get("approval_id").map_err(db_decode_err)?,
            tenant_slug: row.try_get("tenant_slug").map_err(db_decode_err)?,
            trace_id: row.try_get("trace_id").map_err(db_decode_err)?,
            decision_id: row.try_get("decision_id").map_err(db_decode_err)?,
            state: approval_state_from_db(
                row.try_get::<String, _>("state")
                    .map_err(db_decode_err)?
                    .as_str(),
            )?,
            reason: row.try_get("reason").map_err(db_decode_err)?,
            requested_by: row.try_get("requested_by").map_err(db_decode_err)?,
            resolved_by: row.try_get("resolved_by").map_err(db_decode_err)?,
            note: row.try_get("note").map_err(db_decode_err)?,
            created_at: row.try_get("created_at").map_err(db_decode_err)?,
            expires_at: row.try_get("expires_at").map_err(db_decode_err)?,
            resolved_at: row.try_get("resolved_at").map_err(db_decode_err)?,
        };

        if approval.state == ApprovalState::Pending && approval.expires_at <= Utc::now() {
            let now = Utc::now();
            sqlx::query(
                "UPDATE v2_approvals SET state = 'expired', resolved_at = $2 WHERE approval_id = $1",
            )
            .bind(approval_id)
            .bind(now)
            .execute(&self.pool)
            .await
            .map_err(|error| StoreError::Operation(format!("expire approval failed: {error}")))?;
            approval.state = ApprovalState::Expired;
            approval.resolved_at = Some(now);
        }

        Ok(Some(approval))
    }

    async fn put_attestation(&self, envelope: DsseEnvelope) -> Result<(), StoreError> {
        let envelope_json = serde_json::to_value(&envelope).map_err(|error| {
            StoreError::Operation(format!("serialize attestation failed: {error}"))
        })?;

        sqlx::query(
            r#"
            INSERT INTO v2_attestations (attestation_id, trace_id, issued_at, envelope)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (attestation_id)
            DO UPDATE SET envelope = EXCLUDED.envelope
            "#,
        )
        .bind(&envelope.attestation_id)
        .bind(&envelope.trace_id)
        .bind(envelope.issued_at)
        .bind(envelope_json)
        .execute(&self.pool)
        .await
        .map_err(|error| StoreError::Operation(format!("store attestation failed: {error}")))?;

        Ok(())
    }

    async fn get_attestation(
        &self,
        attestation_id: &str,
    ) -> Result<Option<DsseEnvelope>, StoreError> {
        let row = sqlx::query(
            r#"
            SELECT envelope
            FROM v2_attestations
            WHERE attestation_id = $1
            "#,
        )
        .bind(attestation_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|error| StoreError::Operation(format!("get attestation failed: {error}")))?;

        let Some(row) = row else {
            return Ok(None);
        };

        let envelope_json: Value = row.try_get("envelope").map_err(db_decode_err)?;
        let envelope = serde_json::from_value(envelope_json).map_err(|error| {
            StoreError::Operation(format!("decode attestation failed: {error}"))
        })?;

        Ok(Some(envelope))
    }
}

fn approval_state_to_db(state: &ApprovalState) -> &'static str {
    match state {
        ApprovalState::Pending => "pending",
        ApprovalState::Approved => "approved",
        ApprovalState::Denied => "denied",
        ApprovalState::Expired => "expired",
    }
}

fn approval_state_from_db(value: &str) -> Result<ApprovalState, StoreError> {
    match value {
        "pending" => Ok(ApprovalState::Pending),
        "approved" => Ok(ApprovalState::Approved),
        "denied" => Ok(ApprovalState::Denied),
        "expired" => Ok(ApprovalState::Expired),
        _ => Err(StoreError::Operation(format!(
            "unknown approval state in database: {value}"
        ))),
    }
}

fn db_decode_err(error: sqlx::Error) -> StoreError {
    StoreError::Operation(format!("database decode failed: {error}"))
}
