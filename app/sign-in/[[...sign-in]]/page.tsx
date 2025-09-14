import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Welcome to Aldi Assistant</h1>
          <p className="text-muted-foreground mt-2">
            Sign in to access your AI assistant
          </p>
        </div>
        <SignIn
          appearance={{
            elements: {
              formButtonPrimary:
                "bg-primary text-primary-foreground hover:bg-primary/90",
              card: "shadow-lg",
            },
          }}
          redirectUrl="/"
          signUpUrl="/sign-up"
        />
      </div>
    </div>
  );
}
