package com.fj.api.config;

import com.fj.auth.jwt.JwtAuthFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Spring Security UnauthorizedWI-0011 Unauthorized
 * <p>Unauthorized Basic Auth / Form LoginUnauthorized JWT Unauthorized
 * Unauthorized
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    public SecurityConfig(JwtAuthFilter jwtAuthFilter) {
        this.jwtAuthFilter = jwtAuthFilter;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/v1/auth/login", "/api/v1/auth/refresh", "/api/v1/logs/**").permitAll()
                .requestMatchers("/error", "/favicon.ico").permitAll()
                .anyRequest().authenticated()
            )
            .httpBasic(basic -> basic.disable())
            .formLogin(form -> form.disable())
            .exceptionHandling(eh -> eh.authenticationEntryPoint((req, res, ex) -> { res.setStatus(401); res.setContentType("application/json;charset=UTF-8"); res.getWriter().write("{\"code\":401,\"message\":\"Unauthorized\",\"data\":null,\"success\":false}"); }))
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
