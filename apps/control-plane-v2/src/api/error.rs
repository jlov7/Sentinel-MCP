use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Serialize;

use crate::domain::error::DomainError;

#[derive(Debug, Serialize)]
pub struct ErrorPayload {
    pub error: String,
}

#[derive(Debug)]
pub struct ApiError {
    pub status: StatusCode,
    pub message: String,
}

impl ApiError {
    pub fn new(status: StatusCode, message: impl Into<String>) -> Self {
        Self {
            status,
            message: message.into(),
        }
    }
}

impl From<DomainError> for ApiError {
    fn from(value: DomainError) -> Self {
        match value {
            DomainError::Unauthorized(message) => Self::new(StatusCode::UNAUTHORIZED, message),
            DomainError::Forbidden(message) => Self::new(StatusCode::FORBIDDEN, message),
            DomainError::BadRequest(message) => Self::new(StatusCode::BAD_REQUEST, message),
            DomainError::NotFound(message) => Self::new(StatusCode::NOT_FOUND, message),
            DomainError::Conflict(message) => Self::new(StatusCode::CONFLICT, message),
            DomainError::Internal(message) => Self::new(StatusCode::INTERNAL_SERVER_ERROR, message),
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (
            self.status,
            Json(ErrorPayload {
                error: self.message,
            }),
        )
            .into_response()
    }
}
