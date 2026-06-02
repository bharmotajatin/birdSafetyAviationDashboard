"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { signIn } from "next-auth/react";

type LoginFormValues = {
  email: string;
  password: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const result = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    });

    if (!result || result.error) {
      setServerError("Invalid email or password. Please try again.");
      return;
    }

    router.push("/dashboard");
  });

  return (
    <main
      className="min-h-screen"
      style={{
        background: "linear-gradient(180deg, rgba(26,42,94,0.08) 0%, rgba(212,175,55,0.06) 100%)",
      }}
    >
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-10">
        <div
          style={{
            width: "100%",
            background: "#ffffff",
            border: "1px solid #e6e8ee",
            borderRadius: "18px",
            boxShadow: "0 18px 45px rgba(26,42,94,0.14)",
            padding: "28px 24px",
          }}
        >
          <div className="mb-7 flex flex-col items-center text-center">
            <Image
              src="/bird-flight-services-logo.png"
              alt="Bird Flight Services"
              width={220}
              height={52}
              priority
            />
            <p className="mt-3 text-sm" style={{ color: "#5b6477" }}>
              Safety Management System Login
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-semibold" style={{ color: "#1a2a5e" }}>
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="name@birdflightservices.com"
                {...register("email", {
                  required: "Email is required",
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: "Enter a valid email address",
                  },
                })}
                style={{
                  width: "100%",
                  border: "1px solid #d9deea",
                  borderRadius: "10px",
                  padding: "11px 12px",
                  fontSize: "14px",
                  outline: "none",
                }}
              />
              {errors.email ? (
                <p className="mt-1 text-xs" style={{ color: "#c0392b" }}>
                  {errors.email.message}
                </p>
              ) : null}
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-semibold" style={{ color: "#1a2a5e" }}>
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                {...register("password", { required: "Password is required", minLength: 6 })}
                style={{
                  width: "100%",
                  border: "1px solid #d9deea",
                  borderRadius: "10px",
                  padding: "11px 12px",
                  fontSize: "14px",
                  outline: "none",
                }}
              />
              {errors.password ? (
                <p className="mt-1 text-xs" style={{ color: "#c0392b" }}>
                  Password is required
                </p>
              ) : null}
            </div>

            {serverError ? (
              <p
                role="alert"
                style={{
                  background: "#fef0ef",
                  border: "1px solid #f4c7c2",
                  color: "#a63329",
                  borderRadius: "8px",
                  padding: "8px 10px",
                  fontSize: "12px",
                }}
              >
                {serverError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                width: "100%",
                background: "#1a2a5e",
                color: "#d4af37",
                border: "none",
                borderRadius: "10px",
                padding: "12px",
                fontWeight: 700,
                fontSize: "14px",
                cursor: isSubmitting ? "not-allowed" : "pointer",
                opacity: isSubmitting ? 0.8 : 1,
              }}
            >
              {isSubmitting ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="mt-4 text-center">
            <Link href="#" className="text-sm font-medium" style={{ color: "#1a2a5e" }}>
              Forgot password?
            </Link>
          </div>

          <p className="mt-8 text-center text-xs" style={{ color: "#8a93a8" }}>
            BFS Safety Management System v1.0
          </p>
        </div>
      </div>
    </main>
  );
}
