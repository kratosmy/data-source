package com.data.service.core.security;

import jakarta.servlet.http.HttpServletRequest;

final class ReturnUrlSupport {

    private static final String DEFAULT_RETURN_URL = "/";

    private ReturnUrlSupport() {
    }

    static String normalize(String returnUrl) {
        if (returnUrl == null || returnUrl.isBlank() || !returnUrl.startsWith("/") || returnUrl.startsWith("//")) {
            return DEFAULT_RETURN_URL;
        }

        return returnUrl;
    }

    static String toFrontendRedirectTarget(String normalizedReturnUrl, String frontendBaseUrl) {
        String safeReturnUrl = normalize(normalizedReturnUrl);
        if (frontendBaseUrl == null || frontendBaseUrl.isBlank()) {
            return safeReturnUrl;
        }

        String normalizedBaseUrl = frontendBaseUrl.endsWith("/")
                ? frontendBaseUrl.substring(0, frontendBaseUrl.length() - 1)
                : frontendBaseUrl;
        return normalizedBaseUrl + safeReturnUrl;
    }

    static String resolveAndClear(HttpServletRequest request) {
        if (request.getSession(false) == null) {
            return DEFAULT_RETURN_URL;
        }

        try {
            Object sessionValue = request.getSession(false).getAttribute(AuthController.RETURN_URL_SESSION_ATTRIBUTE);
            if (sessionValue instanceof String stringValue) {
                return normalize(stringValue);
            }

            return DEFAULT_RETURN_URL;
        } finally {
            request.getSession(false).removeAttribute(AuthController.RETURN_URL_SESSION_ATTRIBUTE);
        }
    }
}
