'use client';
import { signIn, signOut, useSession } from 'next-auth/react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';

export function Topbar() {
  const { data: session } = useSession();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();


  const handleProfileClick = () => {
    setIsDropdownOpen((prev) => !prev);
  };

 
  const handleLogout = async () => {
    setIsDropdownOpen(false);
    await signOut();
  };

 
  const handlesubmission = () => {
    setIsDropdownOpen(false);
    router.push('/submission');
  };

  const handlehome = () => {
    setIsDropdownOpen(false);
    router.push('/');
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="flex flex-col justify-center items-center pb-6">
      <div className="flex items-center justify-between p-4 bg-gray-800 text-gray-200 w-full lg:w-[90vw] min-h-[88px]">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.svg"
            height={100}
            width={100}
            alt="logo"
            className="bg-purple-200 w-10 h-10"
          />
          <h2 className="font-mono text-xl">Algocrack</h2>
        </div>
        <div className="flex items-center">
          {session?.user?.id ? (
            <div className="relative" ref={dropdownRef}>
              <div
                className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center cursor-pointer hover:bg-gray-300"
                onClick={handleProfileClick}
              >
                <h1 className="text-gray-800 font-semibold text-xl">
                  {session.user.name?.split('')[0]?.toUpperCase()}
                </h1>
              </div>
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-gray-800 text-gray-200 rounded-lg shadow-lg z-51">
                  <ul className="py-2">
                  <li
                      className="px-4 py-2 hover:bg-gray-700 cursor-pointer font-mono text-sm"
                      onClick={handlehome}
                    >
                      Home
                    </li>
                    <li
                      className="px-4 py-2 hover:bg-gray-700 cursor-pointer font-mono text-sm"
                      onClick={handlesubmission}
                    >
                      Submission
                    </li>
                    <li
                      className="px-4 py-2 hover:bg-gray-700 cursor-pointer font-mono text-sm"
                      onClick={handleLogout}
                    >
                      Logout
                    </li>
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => signIn()}
              className="bg-purple-200 text-gray-800 m-2 p-2 rounded-lg font-semibold font-mono hover:bg-purple-300"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
