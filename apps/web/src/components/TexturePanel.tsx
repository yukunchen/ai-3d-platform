'use client';

interface TextureMaps {
  albedo?: string;
  normal?: string;
  roughness?: string;
  metallic?: string;
}

interface TexturePanelProps {
  textures: TextureMaps;
}

const TEXTURE_LABELS: { key: keyof TextureMaps; label: string }[] = [
  { key: 'albedo', label: 'Albedo' },
  { key: 'normal', label: 'Normal' },
  { key: 'roughness', label: 'Roughness' },
  { key: 'metallic', label: 'Metallic' },
];

export default function TexturePanel({ textures }: TexturePanelProps) {
  return (
    <div style={{ marginTop: '1rem' }}>
      <h4 style={{ marginBottom: '0.5rem' }}>Texture Maps</h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
        {TEXTURE_LABELS.map(({ key, label }) => (
          <div key={key} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', marginBottom: '0.25rem', color: '#666' }}>{label}</div>
            {textures[key] ? (
              <img
                src={textures[key]}
                alt={label}
                style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            ) : (
              <div style={{ width: '100%', aspectRatio: '1', background: '#f0f0f0', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: '#999' }}>
                N/A
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
