use axum::http::HeaderMap;
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::{Deserialize, Serialize};

use crate::domain::error::DomainError;
use crate::infra::config::Settings;

#[derive(Clone, Debug)]
pub struct Identity {
    pub sub: String,
    pub tenant: Option<String>,
    pub scopes: Vec<String>,
}

impl Identity {
    pub fn has_scope(&self, scope: &str) -> bool {
        self.scopes.iter().any(|value| value == scope)
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct JwtClaims {
    sub: String,
    tenant: Option<String>,
    scopes: Option<Vec<String>>,
    scope: Option<String>,
    exp: usize,
}

pub fn authenticate(headers: &HeaderMap, settings: &Settings) -> Result<Identity, DomainError> {
    let authorization = headers
        .get("authorization")
        .and_then(|value| value.to_str().ok())
        .ok_or_else(|| DomainError::Unauthorized("missing Authorization header".to_string()))?;

    let token = authorization
        .strip_prefix("Bearer ")
        .ok_or_else(|| DomainError::Unauthorized("invalid Authorization format".to_string()))?;

    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_exp = true;

    let decoded = decode::<JwtClaims>(
        token,
        &DecodingKey::from_secret(settings.jwt_secret.as_bytes()),
        &validation,
    )
    .map_err(|error| DomainError::Unauthorized(format!("invalid token: {error}")))?;

    let mut scopes = decoded.claims.scopes.unwrap_or_default();

    if let Some(scope_str) = decoded.claims.scope {
        let parsed = scope_str
            .split_whitespace()
            .map(|value| value.to_string())
            .collect::<Vec<_>>();
        scopes.extend(parsed);
    }

    scopes.sort();
    scopes.dedup();

    Ok(Identity {
        sub: decoded.claims.sub,
        tenant: decoded.claims.tenant,
        scopes,
    })
}
