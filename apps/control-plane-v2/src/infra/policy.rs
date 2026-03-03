use async_trait::async_trait;
use reqwest::StatusCode;
use serde::{Deserialize, Serialize};
use serde_json::json;
use thiserror::Error;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PolicyResult {
    pub allow: bool,
    pub deny_reason: Option<String>,
    pub quota_remaining: Option<i64>,
}

#[derive(Debug, Error)]
pub enum PolicyError {
    #[error("request to policy engine failed: {0}")]
    RequestFailed(String),
    #[error("policy engine returned non-success status {0}: {1}")]
    HttpStatus(StatusCode, String),
    #[error("policy response missing result")]
    MissingResult,
}

#[async_trait]
pub trait PolicyEngine: Send + Sync {
    async fn evaluate(
        &self,
        package: &str,
        input: serde_json::Value,
    ) -> Result<PolicyResult, PolicyError>;
}

#[derive(Clone)]
pub struct OpaPolicyEngine {
    pub base_url: String,
    pub client: reqwest::Client,
}

impl OpaPolicyEngine {
    pub fn new(base_url: String) -> Self {
        Self {
            base_url,
            client: reqwest::Client::new(),
        }
    }
}

#[derive(Debug, Deserialize)]
struct OpaResponse {
    result: Option<serde_json::Value>,
}

#[async_trait]
impl PolicyEngine for OpaPolicyEngine {
    async fn evaluate(
        &self,
        package: &str,
        input: serde_json::Value,
    ) -> Result<PolicyResult, PolicyError> {
        let path = package.trim_start_matches('/');
        let url = format!("{}/v1/data/{path}", self.base_url.trim_end_matches('/'));

        let response = self
            .client
            .post(url)
            .json(&json!({ "input": input }))
            .send()
            .await
            .map_err(|error| PolicyError::RequestFailed(error.to_string()))?;

        let status = response.status();
        let text = response
            .text()
            .await
            .map_err(|error| PolicyError::RequestFailed(error.to_string()))?;

        if !status.is_success() {
            return Err(PolicyError::HttpStatus(status, text));
        }

        let payload: OpaResponse = serde_json::from_str(&text)
            .map_err(|error| PolicyError::RequestFailed(error.to_string()))?;
        let result_value = payload.result.ok_or(PolicyError::MissingResult)?;

        let allow = result_value
            .get("allow")
            .and_then(|value| value.as_bool())
            .unwrap_or(false);
        let quota_remaining = result_value
            .get("quota_remaining")
            .and_then(|value| value.as_i64());

        let deny_reason = result_value.get("deny_reason").and_then(|value| {
            if let Some(value) = value.as_str() {
                Some(value.to_string())
            } else {
                value
                    .as_array()
                    .and_then(|items| items.first())
                    .and_then(|item| item.as_str())
                    .map(|value| value.to_string())
            }
        });

        Ok(PolicyResult {
            allow,
            deny_reason,
            quota_remaining,
        })
    }
}

#[derive(Clone, Debug)]
pub struct StaticPolicyEngine;

#[async_trait]
impl PolicyEngine for StaticPolicyEngine {
    async fn evaluate(
        &self,
        _package: &str,
        input: serde_json::Value,
    ) -> Result<PolicyResult, PolicyError> {
        let purpose = input.get("purpose").and_then(|value| value.as_str());
        let allow = purpose != Some("forbidden");
        Ok(PolicyResult {
            allow,
            deny_reason: if allow {
                None
            } else {
                Some("POLICY_FORBIDDEN_PURPOSE".to_string())
            },
            quota_remaining: Some(100),
        })
    }
}
