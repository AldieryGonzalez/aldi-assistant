import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Join Aldi Assistant</h1>
          <p className="text-muted-foreground mt-2">
            Create an account to get started with your AI assistant
          </p>
        </div>
        <SignUp
          appearance={{
            elements: {
              formButtonPrimary:
                "bg-primary text-primary-foreground hover:bg-primary/90",
              card: "shadow-lg",
            },
          }}
          redirectUrl="/"
          signInUrl="/sign-in"
        />
      </div>
    </div>
  );
}
