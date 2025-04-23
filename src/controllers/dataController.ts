import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

export const yogaVideos = (req: Request, res: Response) => {
  const filePath = path.join(__dirname, '../data/videos.json');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading yogaVideos.json file:', err);
      res.status(500).json({ message: 'Error retrieving Yoga videos.' });
      return;
    }

    try {
      const yogaVideos = JSON.parse(data);
      res.status(200).json(yogaVideos);
    } catch (parseError) {
      console.error('Error processing yogaVideos.json file:', parseError);
      res.status(500).json({ message: 'Error processing Yoga videos.' });
    }
  });
};

export const meditation = (req: Request, res: Response) => {
  const filePath = path.join(__dirname, '../data/meditate.json');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading meditate.json file:', err);
      res.status(500).json({ message: 'Error retrieving Yoga videos.' });
      return;
    }

    try {
      const meditateData = JSON.parse(data);
      res.status(200).json(meditateData);
    } catch (parseError) {
      console.error('Error processing meditate.json file:', parseError);
      res.status(500).json({ message: 'Error processing Yoga videos.' });
    }
  });
}