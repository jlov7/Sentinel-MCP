package sentinel.policy

default allow := false

tenant := input.tenant
tool := input.tool
action := input.action
quota := data.quotas[tenant][tool]

allow {
    tool_allowed
    within_quota
    purpose_ok
}

tool_allowed {
    data.allowlist[tenant][tool]
}

within_quota {
    quota > input.usage
}

quota_remaining := remaining {
    quota := data.quotas[tenant][tool]
    remaining := quota - input.usage
}

purpose_ok {
    required_purpose := data.required_purpose[tenant][tool]
    input.purpose == required_purpose
}

deny_reason[msg] {
    not tool_allowed
    msg := sprintf("tool %s denied for tenant %s", [tool, tenant])
}

deny_reason[msg] {
    not within_quota
    msg := sprintf("quota exceeded for tool %s tenant %s", [tool, tenant])
}

deny_reason[msg] {
    not purpose_ok
    msg := sprintf("purpose %s not allowed for tool %s tenant %s", [input.purpose, tool, tenant])
}
