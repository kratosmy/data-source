package com.data.service.core.security;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.oauth2.client.web.AuthorizationRequestRepository;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.stereotype.Component;
import org.springframework.util.SerializationUtils;

import java.util.Base64;

@Component
public class CookieOAuth2AuthorizationRequestRepository implements AuthorizationRequestRepository<OAuth2AuthorizationRequest> {

    private static final String AUTHORIZATION_REQUEST_COOKIE_NAME = "PANEL_OAUTH2_AUTH_REQUEST";
    private static final int COOKIE_MAX_AGE_SECONDS = 180;

    @Override
    public OAuth2AuthorizationRequest loadAuthorizationRequest(HttpServletRequest request) {
        Cookie cookie = findCookie(request, AUTHORIZATION_REQUEST_COOKIE_NAME);
        if (cookie == null || cookie.getValue() == null || cookie.getValue().isBlank()) {
            return null;
        }

        try {
            byte[] decoded = Base64.getUrlDecoder().decode(cookie.getValue());
            Object deserialized = SerializationUtils.deserialize(decoded);
            if (deserialized instanceof OAuth2AuthorizationRequest authorizationRequest) {
                return authorizationRequest;
            }
        } catch (IllegalArgumentException ex) {
            return null;
        }

        return null;
    }

    @Override
    public void saveAuthorizationRequest(OAuth2AuthorizationRequest authorizationRequest,
                                         HttpServletRequest request,
                                         HttpServletResponse response) {
        if (authorizationRequest == null) {
            deleteCookie(request, response, AUTHORIZATION_REQUEST_COOKIE_NAME);
            return;
        }

        byte[] serialized = SerializationUtils.serialize(authorizationRequest);
        if (serialized == null) {
            deleteCookie(request, response, AUTHORIZATION_REQUEST_COOKIE_NAME);
            return;
        }

        Cookie cookie = new Cookie(AUTHORIZATION_REQUEST_COOKIE_NAME, Base64.getUrlEncoder().encodeToString(serialized));
        cookie.setHttpOnly(true);
        cookie.setSecure(request.isSecure());
        cookie.setPath(resolveCookiePath(request));
        cookie.setMaxAge(COOKIE_MAX_AGE_SECONDS);
        response.addCookie(cookie);
    }

    @Override
    public OAuth2AuthorizationRequest removeAuthorizationRequest(HttpServletRequest request,
                                                                 HttpServletResponse response) {
        OAuth2AuthorizationRequest authorizationRequest = loadAuthorizationRequest(request);
        deleteCookie(request, response, AUTHORIZATION_REQUEST_COOKIE_NAME);
        return authorizationRequest;
    }

    private static Cookie findCookie(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }

        for (Cookie cookie : cookies) {
            if (name.equals(cookie.getName())) {
                return cookie;
            }
        }

        return null;
    }

    private static void deleteCookie(HttpServletRequest request, HttpServletResponse response, String name) {
        Cookie cookie = new Cookie(name, "");
        cookie.setHttpOnly(true);
        cookie.setSecure(request.isSecure());
        cookie.setPath(resolveCookiePath(request));
        cookie.setMaxAge(0);
        response.addCookie(cookie);
    }

    private static String resolveCookiePath(HttpServletRequest request) {
        String contextPath = request.getContextPath();
        return (contextPath == null || contextPath.isBlank()) ? "/" : contextPath;
    }
}
