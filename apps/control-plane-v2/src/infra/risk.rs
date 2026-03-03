use serde_json::Value;

use crate::domain::models::AuthorizationRequest;

#[derive(Clone, Debug)]
pub struct RiskAssessment {
    pub score: f64,
    pub reason_codes: Vec<String>,
}

#[derive(Clone, Debug, Default)]
pub struct RiskEngine;

impl RiskEngine {
    pub fn assess(&self, input: &AuthorizationRequest) -> RiskAssessment {
        let mut score: f64 = 0.05;
        let mut reason_codes = Vec::new();

        if input.usage > 1_000 {
            score += 0.35;
            reason_codes.push("RISK_HIGH_USAGE".to_string());
        }

        let lowered_action = input.action.to_ascii_lowercase();
        if lowered_action.contains("write") || lowered_action.contains("delete") {
            score += 0.25;
            reason_codes.push("RISK_MUTATING_ACTION".to_string());
        }

        let sensitive_terms = [
            "token",
            "credential",
            "secrets",
            "payment",
            "pii",
            "admin",
            "wire",
        ];

        let context_text = flatten_value(&input.context).to_ascii_lowercase();
        for term in sensitive_terms {
            if context_text.contains(term) {
                score += 0.11;
                reason_codes.push(format!("RISK_CONTEXT_{term}"));
            }
        }

        if input.purpose.is_none() {
            score += 0.1;
            reason_codes.push("RISK_MISSING_PURPOSE".to_string());
        }

        let bounded_score = score.clamp(0.0, 0.99);
        RiskAssessment {
            score: bounded_score,
            reason_codes,
        }
    }
}

fn flatten_value(value: &Value) -> String {
    match value {
        Value::Null => "null".to_string(),
        Value::Bool(value) => value.to_string(),
        Value::Number(value) => value.to_string(),
        Value::String(value) => value.to_owned(),
        Value::Array(values) => values
            .iter()
            .map(flatten_value)
            .collect::<Vec<_>>()
            .join(" "),
        Value::Object(values) => values
            .iter()
            .map(|(key, value)| format!("{key} {}", flatten_value(value)))
            .collect::<Vec<_>>()
            .join(" "),
    }
}
