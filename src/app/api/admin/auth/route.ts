import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const { password } = await request.json();

        if (!process.env.ADMIN_PASSWORD) {
            return NextResponse.json({ error: 'Admin access not configured' }, { status: 500 });
        }

        if (password === process.env.ADMIN_PASSWORD) {
            return NextResponse.json({
                success: true,
                message: 'Authentication successful'
            });
        }

        return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    } catch (error) {
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
