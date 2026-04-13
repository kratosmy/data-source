package com.data.service.core.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.io.IOException;

@Controller
public class AuthController {

    public static final String RETURN_URL_SESSION_ATTRIBUTE = "auth.return_url";

    private final PanelSecurityProperties securityProperties;

    public AuthController(PanelSecurityProperties securityProperties) {
        this.securityProperties = securityProperties;
    }

    @GetMapping("/api/auth/login")
    public void login(@RequestParam(required = false) String returnUrl,
                      HttpServletRequest request,
                      HttpServletResponse response) throws IOException {
        String normalizedReturnUrl = ReturnUrlSupport.normalize(returnUrl);
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication != null && authentication.isAuthenticated() && !(authentication instanceof AnonymousAuthenticationToken)) {
            response.sendRedirect(ReturnUrlSupport.toFrontendRedirectTarget(
                    normalizedReturnUrl,
                    securityProperties.getFrontendBaseUrl()
            ));
            return;
        }

        request.getSession(true).setAttribute(RETURN_URL_SESSION_ATTRIBUTE, normalizedReturnUrl);
        response.sendRedirect("/oauth2/authorization/" + securityProperties.getPingFederate().getRegistrationId());
    }
}
