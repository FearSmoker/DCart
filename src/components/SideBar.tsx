import { MdSwitchAccount } from "react-icons/md";
import SideBarCartIcon from "./SideBarCartIcon";
import { getSession } from "@/lib/manageSession";
import Image from "next/image";
import Link from "next/link";

const SideBar = async () => {
  const session = await getSession();
  let isSeller = false;
  const userImage = session?.user?.image;
  const userName = session?.user?.name || session?.user?.email || "Admin";
  const userInitials = userName.charAt(0).toUpperCase();

  if (session?.user?.email) {
    const isAdmin =
      session.user.email === process.env.ADMIN_EMAIL ||
      session.user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;

    if (!isAdmin) {
      try {
        const { adminDB } = await import("@/firebaseAdmin");
        const userDoc = await adminDB.collection("users").doc(session.user.email).get();
        if (userDoc.exists) {
          const data = userDoc.data();
          isSeller = data?.role === "seller";
        }
      } catch (err) {
        console.warn("Failed to lookup vendor status in SideBar:", err);
      }
    }
  }

  return (
    <div className="fixed top-60 right-2 z-20 flex flex-col gap-2">
      <Link
        href={session?.user ? "/profile" : "/signin"}
        className="bg-accentWhite w-16 h-[70px] rounded-md flex flex-col gap-1 text-accent justify-center items-center shadow-sm shadow-lightGreen overflow-x-hidden group cursor-pointer"
      >
        <div className="flex justify-center items-center">
          {session?.user && userImage ? (
            <Image
              src={userImage}
              alt="user image"
              width={35}
              height={35}
              className="rounded-full -translate-x-12 group-hover:translate-x-4 transition-transform duration-200"
            />
          ) : session?.user ? (
            <div className="w-[35px] h-[35px] rounded-full bg-lightOrange text-white flex items-center justify-center font-bold text-sm shadow-sm -translate-x-12 group-hover:translate-x-4 transition-transform duration-200 uppercase">
              {userInitials}
            </div>
          ) : (
            <MdSwitchAccount className="text-2xl -translate-x-12 group-hover:translate-x-3 transition-transform duration-200" />
          )}

          {session?.user && userImage ? (
            <Image
              src={userImage}
              alt="user image"
              width={35}
              height={35}
              className="rounded-full -translate-x-4 group-hover:translate-x-12 transition-transform duration-200"
            />
          ) : session?.user ? (
            <div className="w-[35px] h-[35px] rounded-full bg-lightOrange text-white flex items-center justify-center font-bold text-sm shadow-sm -translate-x-4 group-hover:translate-x-12 transition-transform duration-200 uppercase">
              {userInitials}
            </div>
          ) : (
            <MdSwitchAccount className="text-2xl -translate-x-3 group-hover:translate-x-12 transition-transform duration-200" />
          )}
        </div>
        <p className="text-xs font-semibold">Profile</p>
      </Link>
      {!isSeller && <SideBarCartIcon />}
    </div>
  );
};

export default SideBar;
