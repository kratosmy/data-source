package com.data.service.core.security;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;

@Component
public class HumanUserAuthoritiesService {

    private static final Set<String> ALLOWED_AUTHORITY_PREFIXES = Set.of(
            "ROLE_",
            "GROUP_",
            "ENTITLEMENT_",
            "PERMISSION_"
    );

    public Set<GrantedAuthority> mergeAuthorities(Collection<? extends GrantedAuthority> upstreamAuthorities,
                                                  Collection<? extends GrantedAuthority> mappedAuthorities) {
        Set<GrantedAuthority> authorities = new LinkedHashSet<>();

        upstreamAuthorities.stream()
                .filter(this::isAllowedAuthority)
                .forEach(authorities::add);

        authorities.addAll(mappedAuthorities);
        return authorities;
    }

    private boolean isAllowedAuthority(GrantedAuthority authority) {
        if (!(authority instanceof SimpleGrantedAuthority simpleGrantedAuthority)) {
            return true;
        }

        String authorityValue = simpleGrantedAuthority.getAuthority();
        if (authorityValue == null || authorityValue.isBlank()) {
            return false;
        }

        String normalizedAuthority = authorityValue.trim().toUpperCase(Locale.ROOT);
        return ALLOWED_AUTHORITY_PREFIXES.stream().anyMatch(normalizedAuthority::startsWith);
    }
}
