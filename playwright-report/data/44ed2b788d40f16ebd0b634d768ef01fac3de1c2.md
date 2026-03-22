# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e9]:
    - generic [ref=e10]:
      - heading "Login to your account" [level=1] [ref=e11]
      - paragraph [ref=e12]: Enter your email below to login to your account
    - generic [ref=e13]:
      - generic [ref=e14]:
        - generic [ref=e15]: Email
        - textbox "Email" [ref=e18]:
          - /placeholder: m@example.com
      - generic [ref=e19]:
        - generic [ref=e20]:
          - generic [ref=e21]: Password
          - link "Forgot your password?" [ref=e22] [cursor=pointer]:
            - /url: /forgot-password
        - textbox "Password" [ref=e25]
      - button "Login" [ref=e26]
      - generic [ref=e27]: Or continue with
      - button "Login with Google" [ref=e28]:
        - img [ref=e29]
        - text: Login with Google
    - generic [ref=e31]:
      - text: Don't have an account?
      - link "Sign up" [ref=e32] [cursor=pointer]:
        - /url: /register
  - button "Open Next.js Dev Tools" [ref=e38] [cursor=pointer]:
    - img [ref=e39]
  - alert [ref=e42]
```