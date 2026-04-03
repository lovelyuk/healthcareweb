'use client';

import { useState, useRef, FormEvent, MouseEvent } from 'react';
import styles from '../page.module.css';

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const glowsRef = useRef<HTMLDivElement[]>([]);

  function handlePasswordToggle() {
    setShowPassword((prev) => !prev);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const emailInput = form.elements.namedItem('email') as HTMLInputElement;
    const passwordInput = form.elements.namedItem('password') as HTMLInputElement;
    const email = emailInput?.value;
    const password = passwordInput?.value;

    if (!email || !password) return;

    // Save email for user context
    localStorage.setItem('bodycheck_user_email', email);

    setIsLoading(true);

    // Simulate network request
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setIsLoading(false);
    setIsSuccess(true);

    // Redirect to dashboard after brief success display
    await new Promise((resolve) => setTimeout(resolve, 500));
    const lang = localStorage.getItem('preferredLanguage') || 'en';
    const theme = localStorage.getItem('appTheme') || 'dark';
    window.location.href = `/dashboard?theme=${theme}&lang=${lang}&email=${encodeURIComponent(email)}`;
  }

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    if (!glowsRef.current.length) return;
    const x = e.clientX / window.innerWidth;
    const y = e.clientY / window.innerHeight;
    glowsRef.current.forEach((glow, index) => {
      if (!glow) return;
      const speed = (index + 1) * 20;
      const moveX = x * speed - speed / 2;
      const moveY = y * speed - speed / 2;
      glow.style.transform = `translate(${moveX}px, ${moveY}px) scale(1.1)`;
    });
  }

  function handleMouseLeave() {
    glowsRef.current.forEach((glow) => {
      if (glow) glow.style.transform = '';
    });
  }

  return (
    <div
      className={styles.pageWrapper}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Background glow orbs */}
      <div className={styles.backgroundEffects}>
        <div
          className={`${styles.glow} ${styles.glow1}`}
          ref={(el) => { if (el) glowsRef.current[0] = el; }}
        />
        <div
          className={`${styles.glow} ${styles.glow2}`}
          ref={(el) => { if (el) glowsRef.current[1] = el; }}
        />
        <div
          className={`${styles.glow} ${styles.glow3}`}
          ref={(el) => { if (el) glowsRef.current[2] = el; }}
        />
      </div>

      <main className={styles.loginContainer}>
        <div className={styles.loginCard}>
          {/* Header */}
          <header className={styles.brandHeader}>
            <div className={styles.logoIcon}>
              {/* Inline SVG logo — matches original /logo.svg */}
              <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="48" height="48" rx="12" fill="url(#grad)" />
                <path d="M24 10C17.373 10 12 15.373 12 22c0 6.627 5.373 12 12 12s12-5.373 12-12c0-6.627-5.373-12-12-12zm0 22c-5.523 0-10-4.477-10-10S18.477 12 24 12s10 4.477 10 10-4.477 10-10 10z" fill="#00C7FD" opacity="0.9"/>
                <circle cx="24" cy="22" r="5" fill="#00C7FD"/>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#004585"/>
                    <stop offset="1" stopColor="#0071C5"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <h1 data-i18n="login_title">보듬케어</h1>
            <p data-i18n="login_subtitle">Health Management System</p>
          </header>

          {/* Form */}
          <form className={styles.loginForm} onSubmit={handleSubmit}>
            {/* Email */}
            <div className={styles.inputGroup}>
              <label htmlFor="email" data-i18n="login_email">User ID / Email</label>
              <div className={styles.inputWrapper}>
                <i className="fa-regular fa-envelope icon" />
                <input
                  type="email"
                  id="email"
                  name="email"
                  placeholder="Enter your email address"
                  data-i18n="login_email_ph"
                  required
                  autoComplete="username"
                />
                <div className={styles.focusBorder} />
              </div>
            </div>

            {/* Password */}
            <div className={styles.inputGroup}>
              <label htmlFor="password" data-i18n="login_pass">Password</label>
              <div className={styles.inputWrapper}>
                <i className="fa-solid fa-lock icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  placeholder="Enter your password"
                  data-i18n="login_pass_ph"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className={styles.passwordToggle}
                  aria-label="Toggle password visibility"
                  onClick={handlePasswordToggle}
                >
                  <i className={showPassword ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye'} />
                </button>
                <div className={styles.focusBorder} />
              </div>
            </div>

            {/* Options */}
            <div className={styles.formOptions}>
              <label className={styles.checkboxContainer}>
                <input type="checkbox" id="rememberMe" />
                <span className={styles.checkmark} />
                <span data-i18n="login_remember">Remember me</span>
              </label>
              <a href="#" className={styles.forgotPassword} data-i18n="login_forgot">
                Forgot password?
              </a>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className={`${styles.submitBtn} ${isLoading ? styles.loading : ''} ${isSuccess ? styles.success : ''}`}
              disabled={isLoading}
            >
              <span className={styles.btnText} data-i18n="login_btn">
                {isSuccess ? 'Success!' : 'Sign In'}
              </span>
              {!isLoading && !isSuccess && (
                <i className="fa-solid fa-arrow-right btn-icon" />
              )}
              <div className={styles.loaderSpinner} />
            </button>
          </form>

          {/* Divider */}
          <div className={styles.divider}>
            <span data-i18n="login_or">or continue with</span>
          </div>

          {/* Social login */}
          <div className={styles.socialLogin}>
            <button type="button" className={`${styles.socialBtn} ${styles.google}`}>
              <img
                src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/google/google-original.svg"
                alt="Google"
              />
              <span>Google</span>
            </button>
            <button type="button" className={`${styles.socialBtn} ${styles.apple}`}>
              <i className="fa-brands fa-apple" />
              <span>Apple</span>
            </button>
          </div>

          {/* Signup */}
          <p className={styles.signupPrompt}>
            <span data-i18n="login_new">New to RealSense?</span>
            {' '}
            <a href="#" data-i18n="login_create">Create an account</a>
          </p>
        </div>
      </main>
    </div>
  );
}
