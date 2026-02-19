import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path.join('/');
  try {
    const response = await fetch(`${API_URL}/storage/${path}`);
    if (!response.ok) {
      return new NextResponse('Not found', { status: 404 });
    }
    const data = await response.arrayBuffer();
    return new NextResponse(data, {
      headers: {
        'Content-Type': 'model/gltf-binary',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    return new NextResponse('Error', { status: 500 });
  }
}
