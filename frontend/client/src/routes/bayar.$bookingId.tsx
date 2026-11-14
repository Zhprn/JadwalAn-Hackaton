import { createFileRoute, redirect } from "@tanstack/react-router";
import { PaymentQRIS } from "@/components/PaymentQRIS";

export const Route = createFileRoute("/bayar/$bookingId")({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) throw redirect({ to: "/login", search: { redirect: location.href } });
  },
  component: PaymentPage,
});

function PaymentPage() {
  const { bookingId } = Route.useParams();
  return (
    <div className="bg-[#F8FAFC] -m-4 md:-m-8 pb-24 md:pb-12 pt-6 px-4 md:px-8 min-h-screen">
      <div className="max-w-[1200px] mx-auto">
        <PaymentQRIS bookingId={bookingId} />
      </div>
    </div>
  );
}
