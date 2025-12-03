import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/models/User';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.ADMIN_PASSWORD}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const user = await User.findById(params.id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    user.banned = !user.banned;
    await user.save();

    return NextResponse.json({
      success: true,
      user,
      message: user.banned ? 'User banned successfully' : 'User unbanned successfully'
    });
  } catch (error) {
    console.error('Error toggling user ban:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
