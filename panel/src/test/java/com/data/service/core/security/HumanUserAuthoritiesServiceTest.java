package com.data.service.core.security;

import org.junit.jupiter.api.Test;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.user.OAuth2UserAuthority;

import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class HumanUserAuthoritiesServiceTest {

    private final HumanUserAuthoritiesService service = new HumanUserAuthoritiesService();

    @Test
    void mergeAuthoritiesRemovesUnexpectedSimpleAuthoritiesAndKeepsMappedAuthorities() {
        List<GrantedAuthority> upstreamAuthorities = List.of(
                new OAuth2UserAuthority(Map.of("sub", "user-1")),
                new SimpleGrantedAuthority("SCOPE_openid"),
                new SimpleGrantedAuthority("ROLE_USER")
        );

        List<GrantedAuthority> mappedAuthorities = List.of(
                new SimpleGrantedAuthority("GROUP_TRADING"),
                new SimpleGrantedAuthority("PERMISSION_MODULE_DATA_EXPLORER")
        );

        Set<GrantedAuthority> authorities = service.mergeAuthorities(upstreamAuthorities, mappedAuthorities);

        assertThat(authorities)
                .extracting(GrantedAuthority::getAuthority)
                .contains("ROLE_USER", "GROUP_TRADING", "PERMISSION_MODULE_DATA_EXPLORER")
                .doesNotContain("SCOPE_openid");
        assertThat(authorities)
                .anyMatch(authority -> authority instanceof OAuth2UserAuthority);
    }
}
