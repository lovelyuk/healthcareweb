import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('results')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) return res.status(404).json({ error: 'Measurement not found' });

      // Map back to bodyCheckReport format
      const report = {
        id: data.id,
        createdAt: data.created_at,
        ...data.result_payload,
        ...data.analysis_payload,
        analysisReady: true
      };

      return res.status(200).json(report);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { error } = await supabase
        .from('results')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return res.status(204).end();
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
