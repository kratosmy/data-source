package com.data.service.core.security;

import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.web.ServerProperties;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import javax.security.auth.x500.X500Principal;
import java.security.Principal;
import java.security.cert.X509Certificate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oauth2Login;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = {
        "panel.security.ping-federate.registration-id=pingfed",
        "panel.security.ping-federate.logout-success-url=/",
        "panel.security.frontend-base-url=https://app.example.test",
        "panel.security.claim-mapping.username-claim=preferred_username",
        "panel.security.claim-mapping.display-name-claim=name",
        "panel.security.claim-mapping.email-claim=email",
        "panel.security.claim-mapping.groups-claim=groups",
        "panel.security.claim-mapping.entitlements-claim=entitlements",
        "panel.security.claim-mapping.permissions-claim=permissions",
        "panel.security.claim-mapping.data-scopes-claim=data_scopes",
        "panel.security.application-clients[0].name=grafana",
        "panel.security.application-clients[0].certificate-cn=grafana-test",
        "panel.security.application-clients[0].authorities[0]=ROLE_APP_GRAFANA",
        "spring.security.oauth2.client.registration.pingfed.client-id=test-client",
        "spring.security.oauth2.client.registration.pingfed.client-secret=test-secret",
        "spring.security.oauth2.client.registration.pingfed.authorization-grant-type=authorization_code",
        "spring.security.oauth2.client.registration.pingfed.redirect-uri=https://api.example.test/login/oauth2/code/{registrationId}",
        "spring.security.oauth2.client.registration.pingfed.scope=openid,profile,email",
        "spring.security.oauth2.client.provider.pingfed.authorization-uri=https://pingfed.example.test/as/authorization.oauth2",
        "spring.security.oauth2.client.provider.pingfed.token-uri=https://pingfed.example.test/as/token.oauth2",
        "spring.security.oauth2.client.provider.pingfed.user-info-uri=https://pingfed.example.test/idp/userinfo.openid",
        "spring.security.oauth2.client.provider.pingfed.user-name-attribute=sub",
        "server.servlet.session.cookie.same-site=lax"
})
class SecurityIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ServerProperties serverProperties;

    @Test
    void loginEntrypointRedirectsToOAuthAuthorizationEndpoint() throws Exception {
        mockMvc.perform(get("/api/auth/login").param("returnUrl", "/workspace"))
                .andExpect(status().is3xxRedirection())
                .andExpect(header().string("Location", "/oauth2/authorization/pingfed"))
                .andExpect(request().sessionAttribute("auth.return_url", "/workspace"));
    }

    @Test
    void oauthAuthorizationRedirectUsesConfiguredBackendCallback() throws Exception {
        mockMvc.perform(get("/oauth2/authorization/pingfed")
                        .header("Host", "api.example.test")
                        .header("X-Forwarded-Host", "app.example.test")
                        .header("X-Forwarded-Port", "443")
                        .header("X-Forwarded-Proto", "https"))
                .andExpect(status().is3xxRedirection())
                .andExpect(header().string("Location", containsString(
                        "redirect_uri=https://api.example.test/login/oauth2/code/pingfed")));
    }

    @Test
    void sessionCookieSameSitePolicyAllowsOidcCallbackNavigation() {
        assertThat(serverProperties.getServlet().getSession().getCookie().getSameSite())
                .hasToString("LAX");
    }

    @Test
    void unauthenticatedApiRequestReturns401InsteadOfLoginRedirect() throws Exception {
        mockMvc.perform(get("/api/user/cryptoassets"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void unauthenticatedCurrentUserRequestReturns401InsteadOfLoginRedirect() throws Exception {
        mockMvc.perform(get("/api/me"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void unauthenticatedSessionStatusReportsAnonymousSessionWithoutRedirect() throws Exception {
        mockMvc.perform(get("/api/auth/session"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authenticated").value(false))
                .andExpect(jsonPath("$.loginUrl").value("/api/auth/login"));
    }

    @Test
    void authenticatedSessionStatusIncludesExpiryForFrontendReauthScheduling() throws Exception {
        MockHttpSession session = new MockHttpSession();
        session.setMaxInactiveInterval(300);

        mockMvc.perform(get("/api/auth/session")
                        .session(session)
                        .with(oauth2Login()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authenticated").value(true))
                .andExpect(jsonPath("$.expiresAt").isNotEmpty())
                .andExpect(jsonPath("$.loginUrl").value("/api/auth/login"));
    }

    @Test
    void unauthenticatedExportEmailRequestReturns401InsteadOfLoginRedirect() throws Exception {
        mockMvc.perform(post("/api/user/trades/export/email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validExportEmailPayload()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void authenticatedUserWithMatchingGroupCanLoadUserEntity() throws Exception {
        mockMvc.perform(get("/api/user/trades").with(oauth2Login().attributes(attributes ->
                        attributes.put("groups", List.of("acl_service_test_trades_reader")))))
                .andExpect(status().isOk());
    }

    @Test
    void authenticatedUserWithDifferentEnvironmentGroupCannotLoadUserEntity() throws Exception {
        mockMvc.perform(get("/api/user/trades").with(oauth2Login().attributes(attributes ->
                        attributes.put("groups", List.of("acl_service_prod_trades_reader")))))
                .andExpect(status().isForbidden());
    }

    @Test
    void authenticatedUserCanLoadNormalizedCurrentUserContext() throws Exception {
        mockMvc.perform(get("/api/me").with(oauth2Login().attributes(attributes -> {
                    attributes.put("sub", "user-123");
                    attributes.put("preferred_username", "alice");
                    attributes.put("name", "Alice Example");
                    attributes.put("email", "alice@example.com");
                    attributes.put("groups", List.of("trading", "ops"));
                    attributes.put("entitlements", List.of("dashboard:view"));
                    attributes.put("permissions", List.of("module:data-explorer"));
                    attributes.put("data_scopes", Map.of("accountIds", List.of("A1", "A2")));
                })))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("user-123"))
                .andExpect(jsonPath("$.username").value("alice"))
                .andExpect(jsonPath("$.displayName").value("Alice Example"))
                .andExpect(jsonPath("$.groups[0]").value("trading"))
                .andExpect(jsonPath("$.entitlements[0]").value("dashboard:view"))
                .andExpect(jsonPath("$.permissions[0]").value("module:data-explorer"))
                .andExpect(jsonPath("$.dataScopes.accountIds[0]").value("A1"));
    }

    @Test
    void authenticatedUserCanSubmitExportEmailRequest() throws Exception {
        mockMvc.perform(post("/api/user/trades/export/email")
                        .with(oauth2Login().attributes(attributes ->
                                attributes.put("groups", List.of("acl_service_test_trades_exporter"))))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validExportEmailPayload()))
                .andExpect(status().isAccepted())
                .andExpect(content().string(""));
    }

    @Test
    void grafanaPathRejectsMissingClientCertificateWithoutRedirect() throws Exception {
        mockMvc.perform(get("/api/grafana/me"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void trustedGrafanaCertificateCanLoadApplicationContext() throws Exception {
        mockMvc.perform(get("/api/grafana/me")
                        .requestAttr("jakarta.servlet.request.X509Certificate",
                                new X509Certificate[]{certificate("CN=grafana-test, OU=Observability, O=Example Corp")}))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("grafana"))
                .andExpect(jsonPath("$.certificateCn").value("grafana-test"))
                .andExpect(jsonPath("$.authorities[0]").value("ROLE_APP_GRAFANA"));
    }

    @Test
    void unknownGrafanaCertificateCnIsRejected() throws Exception {
        mockMvc.perform(get("/api/grafana/me")
                        .requestAttr("jakarta.servlet.request.X509Certificate",
                                new X509Certificate[]{certificate("CN=unknown-client, OU=Observability, O=Example Corp")}))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void oauth2AuthenticatedUserCannotAccessGrafanaApplicationEndpoint() throws Exception {
        mockMvc.perform(get("/api/grafana/me").with(oauth2Login()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void legacyGenericRouteDoesNotResolveForAuthenticatedUser() throws Exception {
        mockMvc.perform(get("/api/cryptoassets").with(oauth2Login()))
                .andExpect(status().isNotFound());
    }

    @Test
    void logoutEndpointInvalidatesSessionAndRedirects() throws Exception {
        mockMvc.perform(get("/api/auth/logout").with(oauth2Login()))
                .andExpect(status().is3xxRedirection())
                .andExpect(header().string("Location", "/"));
    }

    private X509Certificate certificate(String subjectDn) {
        X509Certificate certificate = Mockito.mock(X509Certificate.class);
        X500Principal principal = new X500Principal(subjectDn);
        Mockito.when(certificate.getSubjectX500Principal()).thenReturn(principal);
        Mockito.when(certificate.getSubjectDN()).thenReturn((Principal) principal);
        return certificate;
    }

    private String validExportEmailPayload() {
        return """
                {
                  "to": ["alice@example.com"],
                  "cc": [],
                  "attachments": [
                    {
                      "fileName": "trades-export.csv",
                      "contentType": "text/csv;charset=utf-8;",
                      "fileBase64": "aWQsdHJhZGVUeXBlCjEsU3BvdAo="
                    }
                  ]
                }
                """;
    }
}
