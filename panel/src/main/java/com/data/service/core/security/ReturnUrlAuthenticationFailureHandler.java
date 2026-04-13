package com.data.service.core.security;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;

@Component
public class ReturnUrlAuthenticationFailureHandler implements AuthenticationFailureHandler {

    private static final String FAILURE_MESSAGE = "Sign-in failed. Please try again.";
    private final PanelSecurityProperties securityProperties;

    public ReturnUrlAuthenticationFailureHandler(PanelSecurityProperties securityProperties) {
        this.securityProperties = securityProperties;
    }

    @Override
    public void onAuthenticationFailure(HttpServletRequest request,
                                        HttpServletResponse response,
                                        AuthenticationException exception) throws IOException, ServletException {
        String loginUrl = ReturnUrlSupport.toFrontendRedirectTarget("/auth/login", securityProperties.getFrontendBaseUrl());
        String redirectTarget = UriComponentsBuilder.fromUriString(loginUrl)
                .queryParam("returnUrl", ReturnUrlSupport.resolveAndClear(request))
                .queryParam("error", FAILURE_MESSAGE)
                .build()
                .encode()
                .toUriString();

        response.sendRedirect(redirectTarget);
    }
}
