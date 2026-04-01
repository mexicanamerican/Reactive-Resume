import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { GithubLogoIcon, GoogleLogoIcon, LinkedinLogoIcon, VaultIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";

import type { RouterOutput } from "@/integrations/orpc/client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/integrations/auth/client";
import { orpc } from "@/integrations/orpc/client";
import { cn } from "@/utils/style";

export function SocialAuth() {
  const { data: providers = {}, isLoading } = useQuery(orpc.auth.providers.list.queryOptions());

  return (
    <>
      <div className="flex items-center gap-x-2">
        <hr className="flex-1" />
        <span className="text-xs font-medium tracking-wide">
          <Trans context="Choose to authenticate with a social provider (Google, GitHub, etc.) instead of email and password">
            or continue with
          </Trans>
        </span>
        <hr className="flex-1" />
      </div>

      {isLoading ? <SocialAuthSkeleton /> : <SocialAuthButtons providers={providers} />}
    </>
  );
}

function SocialAuthSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}

type SocialAuthButtonsProps = {
  providers: RouterOutput["auth"]["providers"]["list"];
};

function SocialAuthButtons({ providers }: SocialAuthButtonsProps) {
  const router = useRouter();

  const handleSocialLogin = async (provider: string) => {
    const toastId = toast.loading(t`Signing in...`);

    const { error } = await authClient.signIn.social({
      provider,
      callbackURL: "/dashboard",
    });

    if (error) {
      toast.error(error.message, { id: toastId });
      return;
    }

    toast.dismiss(toastId);
    await router.invalidate();
  };

  const handleOAuthLogin = async () => {
    const toastId = toast.loading(t`Signing in...`);

    const { error } = await authClient.signIn.oauth2({
      providerId: "custom",
      callbackURL: "/dashboard",
    });

    if (error) {
      toast.error(error.message, { id: toastId });
      return;
    }

    toast.dismiss(toastId);
    await router.invalidate();
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      <Button
        variant="secondary"
        onClick={handleOAuthLogin}
        className={cn("hidden", "custom" in providers && "inline-flex")}
      >
        <VaultIcon />
        {providers.custom}
      </Button>

      <Button
        onClick={() => handleSocialLogin("google")}
        className={cn(
          "hidden flex-1 bg-[#4285F4] text-white hover:bg-[#4285F4]/80",
          "google" in providers && "inline-flex",
        )}
      >
        <GoogleLogoIcon />
        Google
      </Button>

      <Button
        onClick={() => handleSocialLogin("github")}
        className={cn(
          "hidden flex-1 bg-[#2b3137] text-white hover:bg-[#2b3137]/80",
          "github" in providers && "inline-flex",
        )}
      >
        <GithubLogoIcon />
        GitHub
      </Button>

      <Button
        onClick={() => handleSocialLogin("linkedin")}
        className={cn(
          "hidden flex-1 bg-[#0A66C2] text-white hover:bg-[#0A66C2]/80",
          "linkedin" in providers && "inline-flex",
        )}
      >
        <LinkedinLogoIcon />
        LinkedIn
      </Button>
    </div>
  );
}
