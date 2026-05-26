package com.data.service.core.security;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserRequest;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserService;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.client.web.AuthorizationRequestRepository;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.logout.LogoutSuccessHandler;
import org.springframework.security.web.util.matcher.AntPathRequestMatcher;
import org.springframework.web.filter.ForwardedHeaderFilter;

import java.util.LinkedHashSet;
import java.util.Set;

@Configuration
@EnableMethodSecurity
@EnableConfigurationProperties(PanelSecurityProperties.class)
public class SecurityConfiguration {

    @Bean
    ForwardedHeaderFilter forwardedHeaderFilter() {
        return new ForwardedHeaderFilter();
    }

    @Bean
    AuthorizationRequestRepository<OAuth2AuthorizationRequest> authorizationRequestRepository() {
        return new LoggingAuthorizationRequestRepository();
    }

    @Bean
    @Order(0)
    @ConditionalOnProperty(prefix = "panel.security.local-dev", name = "auth-disabled", havingValue = "true")
    SecurityFilterChain localDevelopmentSecurityFilterChain(HttpSecurity http,
                                                            PanelSecurityProperties securityProperties,
                                                            LogoutSuccessHandler logoutSuccessHandler) throws Exception {
        http.securityMatcher("/api/user/**", "/api/me", "/api/auth/**", "/oauth2/**", "/login/oauth2/**", "/h2-console/**")
                .authorizeHttpRequests(authorize -> authorize.anyRequest().permitAll())
                .logout(logout -> logout
                        .logoutRequestMatcher(new AntPathRequestMatcher("/api/auth/logout", "GET"))
                        .invalidateHttpSession(true)
                        .clearAuthentication(true)
                        .deleteCookies("JSESSIONID")
                        .logoutSuccessHandler(logoutSuccessHandler))
                .csrf(csrf -> csrf.ignoringRequestMatchers("/api/user/**", "/api/me", "/api/auth/**", "/h2-console/**"))
                .headers(headers -> {
                    if (securityProperties.isH2ConsoleEnabled()) {
                        headers.frameOptions(frameOptions -> frameOptions.sameOrigin());
                    }
                })
                .requestCache(requestCache -> requestCache.disable())
                .oauth2Login(oauth2Login -> oauth2Login.disable())
                .httpBasic(httpBasic -> httpBasic.disable())
                .formLogin(formLogin -> formLogin.disable());

        return http.build();
    }

    @Bean
    @Order(1)
    SecurityFilterChain grafanaSecurityFilterChain(HttpSecurity http,
                                                   ApplicationClientUserDetailsService applicationClientUserDetailsService) throws Exception {
        http.securityMatcher("/api/grafana/**")
                .authorizeHttpRequests(authorize -> authorize.anyRequest().authenticated())
                .x509(x509 -> x509
                        .subjectPrincipalRegex("CN=(.*?)(?:,|$)")
                        .userDetailsService(applicationClientUserDetailsService))
                .csrf(csrf -> csrf.disable())
                .requestCache(requestCache -> requestCache.disable())
                .securityContext(securityContext -> securityContext.disable())
                .exceptionHandling(exceptionHandling -> exceptionHandling
                        .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED))
                        .accessDeniedHandler((request, response, accessDeniedException) ->
                                response.sendError(HttpServletResponse.SC_FORBIDDEN)));

        return http.build();
    }

    @Bean
    @Order(2)
    SecurityFilterChain applicationSecurityFilterChain(HttpSecurity http,
                                                       PanelSecurityProperties securityProperties,
                                                       AuthorizationRequestRepository<OAuth2AuthorizationRequest> authorizationRequestRepository,
                                                       ReturnUrlAuthenticationSuccessHandler successHandler,
                                                       ReturnUrlAuthenticationFailureHandler failureHandler,
                                                       LogoutSuccessHandler logoutSuccessHandler,
                                                       OAuth2UserService<OAuth2UserRequest, OAuth2User> oauth2UserService,
                                                       OAuth2UserService<OidcUserRequest, OidcUser> oidcUserService) throws Exception {
        http.securityMatcher("/api/user/**", "/api/me", "/api/auth/**", "/oauth2/**", "/login/oauth2/**", "/h2-console/**")
                .authorizeHttpRequests(authorize -> {
                    authorize.requestMatchers("/api/auth/login", "/api/auth/logout", "/api/auth/session", "/oauth2/**", "/login/oauth2/**")
                            .permitAll();
                    if (securityProperties.isH2ConsoleEnabled()) {
                        authorize.requestMatchers("/h2-console/**").permitAll();
                    }
                    authorize.anyRequest().authenticated();
                })
                .oauth2Login(oauth2Login -> oauth2Login
                        .authorizationEndpoint(authorizationEndpoint ->
                                authorizationEndpoint
                                        .authorizationRequestRepository(authorizationRequestRepository))
                        .userInfoEndpoint(userInfo -> userInfo
                                .userService(oauth2UserService)
                                .oidcUserService(oidcUserService))
                        .successHandler(successHandler)
                        .failureHandler(failureHandler))
                .logout(logout -> logout
                        .logoutRequestMatcher(new AntPathRequestMatcher("/api/auth/logout", "GET"))
                        .invalidateHttpSession(true)
                        .clearAuthentication(true)
                        .deleteCookies("JSESSIONID")
                        .logoutSuccessHandler(logoutSuccessHandler))
                .csrf(csrf -> csrf.ignoringRequestMatchers("/api/user/**", "/api/me", "/api/auth/**", "/h2-console/**"))
                .headers(headers -> {
                    if (securityProperties.isH2ConsoleEnabled()) {
                        headers.frameOptions(frameOptions -> frameOptions.sameOrigin());
                    }
                })
                .exceptionHandling(exceptionHandling -> exceptionHandling
                        .defaultAuthenticationEntryPointFor(
                                new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED),
                                new AntPathRequestMatcher("/api/user/**")))
                .httpBasic(httpBasic -> httpBasic.disable())
                .formLogin(formLogin -> formLogin.disable());

        return http.build();
    }

    @Bean
    LogoutSuccessHandler logoutSuccessHandler(PanelSecurityProperties securityProperties) {
        return (request, response, authentication) -> {
            String target = securityProperties.getPingFederate().getEndSessionEndpoint();
            if (target == null || target.isBlank()) {
                target = securityProperties.getPingFederate().getLogoutSuccessUrl();
            }
            response.sendRedirect(target == null || target.isBlank() ? "/" : target);
        };
    }

    @Bean
    OAuth2UserService<OAuth2UserRequest, OAuth2User> oauth2UserService(BackendUserContextMapper userContextMapper) {
        DefaultOAuth2UserService delegate = new DefaultOAuth2UserService();
        return userRequest -> withMappedOAuth2Authorities(
                userRequest,
                delegate.loadUser(userRequest),
                userContextMapper
        );
    }

    @Bean
    OAuth2UserService<OidcUserRequest, OidcUser> oidcUserService(BackendUserContextMapper userContextMapper) {
        OidcUserService delegate = new OidcUserService();
        return userRequest -> withMappedOidcAuthorities(
                userRequest,
                delegate.loadUser(userRequest),
                userContextMapper
        );
    }

    static OAuth2User withMappedOAuth2Authorities(OAuth2UserRequest userRequest,
                                                  OAuth2User user,
                                                  BackendUserContextMapper userContextMapper) {
        Set<GrantedAuthority> authorities = new LinkedHashSet<>(user.getAuthorities());
        authorities.addAll(userContextMapper.toGrantedAuthorities(user.getAttributes()));

        return new DefaultOAuth2User(
                authorities,
                user.getAttributes(),
                resolveUserNameAttributeName(userRequest.getClientRegistration())
        );
    }

    static OidcUser withMappedOidcAuthorities(OidcUserRequest userRequest,
                                              OidcUser user,
                                              BackendUserContextMapper userContextMapper) {
        Set<GrantedAuthority> authorities = new LinkedHashSet<>(user.getAuthorities());
        authorities.addAll(userContextMapper.toGrantedAuthorities(user.getClaims()));

        String userNameAttributeName = resolveUserNameAttributeName(userRequest.getClientRegistration());
        if (user.getUserInfo() == null) {
            return new DefaultOidcUser(authorities, user.getIdToken(), userNameAttributeName);
        }

        return new DefaultOidcUser(authorities, user.getIdToken(), user.getUserInfo(), userNameAttributeName);
    }

    private static String resolveUserNameAttributeName(ClientRegistration clientRegistration) {
        String userNameAttributeName = clientRegistration.getProviderDetails()
                .getUserInfoEndpoint()
                .getUserNameAttributeName();
        if (userNameAttributeName == null || userNameAttributeName.isBlank()) {
            return "sub";
        }
        return userNameAttributeName;
    }
}
