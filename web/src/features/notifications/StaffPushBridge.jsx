import { useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import { enableStaffPush, syncStaffPush } from "./push";

export default function StaffPushBridge() {
  const { user, isStaff } = useAuth();

  useEffect(() => {
    if (!user || !isStaff) return undefined;

    syncStaffPush();

    const onClick = async (event) => {
      const button = event.target.closest?.('[aria-label="Notifications"]');
      if (!button) return;

      event.preventDefault();
      event.stopPropagation();

      try {
        await enableStaffPush();
        if (Notification.permission === "granted") {
          new Notification("Vhitepizza alerts enabled", {
            body: "New orders, large-order approvals and late-order alerts are now enabled.",
            icon: "/favicon.png",
          });
        }
      } catch (error) {
        console.warn("Push notification setup failed:", error.message);
      }
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [user, isStaff]);

  return null;
}
