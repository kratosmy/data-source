package com.data.service.core.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

@RestController
public class AuthSessionController {

    private static final String LOGIN_URL = "/api/auth/login";

    @GetMapping("/api/auth/session")
    public BackendAuthSession currentSession(Authentication authentication, HttpServletRequest request) {
        boolean authenticated = authentication != null
                && authentication.isAuthenticated()
                && !(authentication instanceof AnonymousAuthenticationToken);

        return new BackendAuthSession(
                authenticated,
                resolveExpiresAt(authenticated, request.getSession(false)),
                LOGIN_URL
        );
    }

    private Instant resolveExpiresAt(boolean authenticated, HttpSession session) {
        if (!authenticated || session == null || session.getMaxInactiveInterval() <= 0) {
            return null;
        }

        return Instant.ofEpochMilli(session.getLastAccessedTime())
                .plusSeconds(session.getMaxInactiveInterval());
    }
}
