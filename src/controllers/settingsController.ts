import { Response } from 'express';
import { AuthRequest } from '../routes/routing';
import { UserModel as User } from '../models/user.model';

export const getSettingsRoute = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;

  if (!userId) {
    return void res.status(400).json({ message: 'User ID is required.' });
  }

  try {
    const user = await User.findById(userId).select('time days hasCompletedSettings');

    if (!user) {
      return void res.status(404).json({ message: 'User not found.' });
    }

    console.log(user.time, user.days, user.hasCompletedSettings);
    return void res.status(200).json({
      time: user.time,
      days: user.days,
      hasCompletedSettings: user.hasCompletedSettings,
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return void res.status(500).json({ message: 'Error fetching settings.' });
  }
};

export const postSettingsRoute = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const { time, days } = req.body;

  console.log(time, days);

  if (!time || !Array.isArray(days)) {
    return void res.status(400).json({ message: 'Time and days are required.' });
  }

  if (!userId) {
    return void res.status(400).json({ message: 'User ID is required.' });
  }

  try {
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { time, days, hasCompletedSettings: true },
      { new: true }
    );

    if (!updatedUser) {
      return void res.status(404).json({ message: 'User not found.' });
    }

    return void res.status(201).json({
      message: 'Settings successfully saved.',
      time: updatedUser.time,
      days: updatedUser.days,
      user: {
        hasCompletedSettings: updatedUser.hasCompletedSettings,
      },
    });
  } catch (error) {
    console.error('Error saving settings:', error);
    return void res.status(500).json({ message: 'Error saving settings.' });
  }
}

export const putSettingsRoute = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const { time, days } = req.body;

  if (!userId) {
    return void res.status(400).json({ message: 'User ID is required.' });
  }

  if (!time || !Array.isArray(days)) {
    return void res.status(400).json({ message: 'Time and days are required.' });
  }

  try {
    const updatedUser = await User.findByIdAndUpdate(userId, { time, days }, { new: true });

    if (!updatedUser) {
      return void res.status(404).json({ message: 'User not found.' });
    }

    return void res.status(200).json({
      message: 'Settings successfully updated.',
      time: updatedUser.time,
      days: updatedUser.days,
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return void res.status(500).json({ message: 'Error updating settings.' });
  }
};