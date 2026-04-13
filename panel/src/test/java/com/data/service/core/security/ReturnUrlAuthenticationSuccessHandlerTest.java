package com.data.service.core.security;

import jakarta.servlet.ServletException;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.TestingAuthenticationToken;

import java.io.IOException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class ReturnUrlAuthenticationSuccessHandlerTest {

    private final PanelSecurityProperties securityProperties = new PanelSecurityProperties();
    private final ReturnUrlAuthenticationSuccessHandler successHandler =
            new ReturnUrlAuthenticationSuccessHandler(securityProperties);

    @Test
    void redirectsToStoredReturnUrlAndClearsSessionAttribute() throws ServletException, IOException {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.getSession(true).setAttribute(AuthController.RETURN_URL_SESSION_ATTRIBUTE, "/workspace");
        MockHttpServletResponse response = new MockHttpServletResponse();

        successHandler.onAuthenticationSuccess(
                request,
                response,
                new TestingAuthenticationToken("user", "password", "ROLE_USER")
        );

        assertEquals("/workspace", response.getRedirectedUrl());
        assertNull(request.getSession(false).getAttribute(AuthController.RETURN_URL_SESSION_ATTRIBUTE));
    }

    @Test
    void fallsBackToRootWhenSessionValueIsMissing() throws ServletException, IOException {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        successHandler.onAuthenticationSuccess(
                request,
                response,
                new TestingAuthenticationToken("user", "password", "ROLE_USER")
        );

        assertEquals("/", response.getRedirectedUrl());
    }

    @Test
    void prependsFrontendBaseUrlWhenConfigured() throws ServletException, IOException {
        securityProperties.setFrontendBaseUrl("https://frontend.example.test");
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.getSession(true).setAttribute(AuthController.RETURN_URL_SESSION_ATTRIBUTE, "/workspace");
        MockHttpServletResponse response = new MockHttpServletResponse();

        successHandler.onAuthenticationSuccess(
                request,
                response,
                new TestingAuthenticationToken("user", "password", "ROLE_USER")
        );

        assertEquals("https://frontend.example.test/workspace", response.getRedirectedUrl());
    }
}
