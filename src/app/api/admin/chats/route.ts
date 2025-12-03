import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import ChatSession from '@/models/ChatSession';

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.ADMIN_PASSWORD}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await dbConnect();

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');

        const chats = await ChatSession.find()
            .sort({ startedAt: -1 })
            .limit(limit)
            .skip((page - 1) * limit)
            .select('-__v');

        const total = await ChatSession.countDocuments();

        return NextResponse.json({
            chats,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching chats:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
