package com.data.service.core.security;

import java.time.Instant;

public record BackendAuthSession(
        boolean authenticated,
        Instant expiresAt,
        String loginUrl
) {
}
