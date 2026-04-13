package com.data.service.core.security;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
public class ReturnUrlAuthenticationSuccessHandler implements AuthenticationSuccessHandler {

    private final PanelSecurityProperties securityProperties;

    public ReturnUrlAuthenticationSuccessHandler(PanelSecurityProperties securityProperties) {
        this.securityProperties = securityProperties;
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) throws IOException, ServletException {
        response.sendRedirect(ReturnUrlSupport.toFrontendRedirectTarget(
                ReturnUrlSupport.resolveAndClear(request),
                securityProperties.getFrontendBaseUrl()
        ));
    }
}
