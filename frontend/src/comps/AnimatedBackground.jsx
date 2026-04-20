// AnimatedBackground.jsx
// This component renders the animated blobs behind the main card

function AnimatedBackground() {
  return (
    <>
      {/* Blob 1 — top left */}
      <div className="absolute top-0 left-0 w-72 h-72 bg-blue-300 dark:bg-blue-800 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-xl opacity-100 animate-blob"></div>

      {/* Blob 2 — top right, delayed 2s */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-purple-300 dark:bg-purple-800 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-xl opacity-100 animate-blob animation-delay-2000"></div>
    
    

      {/* Blob 3 — bottom center, delayed 4s */}
      <div className="absolute bottom-0 left-1/2 w-72 h-72 bg-pink-300 dark:bg-pink-800 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-xl opacity-100 animate-blob animation-delay-4000"></div>
    </>


  );
}

export default AnimatedBackground;