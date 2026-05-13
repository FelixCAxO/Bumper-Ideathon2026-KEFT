import dashboardBannerImage from "@/assets/dashboard-banner.png";
import dashboardLogoImage from "@/assets/dashboard-logo.png";

type BrandAssetProps = {
  className?: string;
};

export function BumperLogo({ className }: BrandAssetProps) {
  return (
    <img
      src={dashboardLogoImage}
      alt="Bumper"
      className={`block object-contain ${className ?? ""}`}
    />
  );
}

export function BumperDashboardBanner({ className }: BrandAssetProps) {
  return (
    <section
      className={`mt-5 overflow-hidden rounded-3xl shadow-[0_24px_60px_rgba(91,72,223,0.25)] ${className ?? ""}`}
    >
      <img
        src={dashboardBannerImage}
        alt="Let them play, but keep them in their lanes. Bumper helps you stay informed about what matters without crossing the line."
        className="block w-full h-auto"
      />
    </section>
  );
}
