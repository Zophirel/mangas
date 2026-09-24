# License notice

This migration is based on the `mangaworld` extension sources from the
`keiyoushi/extensions-source` repository, commit
`bda90419a594215cb879b48f5cbb650895c52fab`.

The repository is licensed under the Apache License 2.0. The original
copyright and license notices must be retained when distributing derivative
work. This TypeScript port is an independent translation and does not include
APK, JAR, or compiled extension artifacts.

The license of the source code does not grant rights to redistribute manga,
chapter images, or other content served by MangaWorld. Use this adapter only
where the operator has the necessary authorization and in compliance with the
site's terms, robots.txt, copyright law, and applicable rate limits.

## Protection limitation

The original Kotlin source contains a `CookieRedirectInterceptor` that reads a
JavaScript-generated `MWCookie` challenge and retries the request. This port
does not execute site JavaScript, extract challenge cookies, or bypass
Cloudflare/anti-bot protections. Requests that contain such a challenge fail
with `SourceProtectionError`.
