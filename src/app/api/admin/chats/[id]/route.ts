import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import ChatSession from '@/models/ChatSession';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.ADMIN_PASSWORD}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await dbConnect();

        const { id } = await params;
        const chat = await ChatSession.findById(id);
        if (!chat) {
            return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
        }

        return NextResponse.json({ chat });
    } catch (error) {
        console.error('Error fetching chat:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.ADMIN_PASSWORD}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await dbConnect();

        const { reportReason } = await request.json();
        const { id } = await params;

        const chat = await ChatSession.findByIdAndUpdate(
            id,
            {
                reported: true,
                reportReason
            },
            { new: true }
        );

        if (!chat) {
            return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            message: 'Chat reported successfully'
        });
    } catch (error) {
        console.error('Error reporting chat:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
