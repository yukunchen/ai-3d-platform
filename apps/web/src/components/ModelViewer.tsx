'use client';

import { useState, Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Stage } from '@react-three/drei';

interface ModelViewerProps {
  /** URL of the GLB/GLTF model */
  modelUrl: string;
  /** Optional className for styling */
  className?: string;
  /** Optional height of the viewer (default: 500px) */
  height?: string | number;
  /** Optional camera position */
  cameraPosition?: [number, number, number];
  /** Enable or disable zoom (default: true) */
  enableZoom?: boolean;
  /** Enable or disable pan (default: true) */
  enablePan?: boolean;
}

function LoadingOverlay({ isLoading }: { isLoading: boolean }) {
  if (!isLoading) return null;
  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10,
      }}
    >
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#333',
        fontFamily: 'system-ui, sans-serif',
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid #f3f3f3',
          borderTop: '3px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
        <p style={{ marginTop: '12px', fontSize: '14px' }}>
          Loading...
        </p>
      </div>
    </div>
  );
}

function Model({ url, onError: _onError }: { url: string; onError: (error: Error) => void }) {
  console.log('[ModelViewer] Loading URL:', url);

  const { scene } = useGLTF(url);

  useEffect(() => {
    if (scene) {
      console.log('[ModelViewer] Scene loaded, children:', scene.children.length);
    }
  }, [scene]);

  if (!scene) {
    return null;
  }

  return <primitive object={scene} />;
}

function ModelContent({
  modelUrl,
  onError,
}: {
  modelUrl: string;
  onError: (error: Error) => void;
}) {
  return (
    <Model url={modelUrl} onError={onError} />
  );
}

function Scene({
  modelUrl,
  onError,
  enableZoom,
  enablePan,
}: {
  modelUrl: string;
  onError: (error: Error) => void;
  enableZoom?: boolean;
  enablePan?: boolean;
}) {
  return (
    <>
      <Stage
        environment="city"
        intensity={0.6}
        adjustCamera={false}
      >
        <Suspense fallback={null}>
          <ModelContent modelUrl={modelUrl} onError={onError} />
        </Suspense>
      </Stage>
      <OrbitControls
        makeDefault
        enableZoom={enableZoom !== false}
        enablePan={enablePan !== false}
        minDistance={1}
        maxDistance={50}
      />
    </>
  );
}

/**
 * ModelViewer - A 3D model viewer component for displaying GLB/GLTF models
 *
 * @example
 * ```tsx
 * import ModelViewer from '@/components/ModelViewer';
 *
 * <ModelViewer
 *   modelUrl="https://example.com/model.glb"
 *   height={500}
 * />
 * ```
 */
function ModelViewer({
  modelUrl,
  className,
  height = 500,
  cameraPosition,
  enableZoom = true,
  enablePan = true,
}: ModelViewerProps) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const handleError = (err: Error) => {
    setError(err.message);
    setIsLoading(false);
  };

  const handleCreated = () => {
    setIsLoading(false);
  };

  if (!modelUrl) {
    return (
      <div
        className={className}
        style={{
          height: typeof height === 'number' ? `${height}px` : height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f5f5f5',
          borderRadius: '8px',
          color: '#666',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        Please provide a model URL
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        height: typeof height === 'number' ? `${height}px` : height,
        width: '100%',
        position: 'relative',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      {error ? (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#fef2f2',
            color: '#dc2626',
            fontFamily: 'system-ui, sans-serif',
            padding: '20px',
            textAlign: 'center',
          }}
        >
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p style={{ marginTop: '12px', fontWeight: 500 }}>Failed to load model</p>
          <p style={{ marginTop: '4px', fontSize: '14px', color: '#991b1b' }}>
            {error}
          </p>
        </div>
      ) : (
        <>
          <LoadingOverlay isLoading={isLoading} />
          <Canvas
            onCreated={handleCreated}
            camera={{ position: cameraPosition || [0, 0, 5], fov: 50 }}
            style={{ background: 'transparent' }}
            gl={{ preserveDrawingBuffer: true }}
          >
            <Scene
              modelUrl={modelUrl}
              onError={handleError}
              enableZoom={enableZoom}
              enablePan={enablePan}
            />
          </Canvas>
        </>
      )}
    </div>
  );
}

export default ModelViewer;
