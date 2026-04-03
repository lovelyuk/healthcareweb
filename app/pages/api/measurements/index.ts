import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { subjectNo, limit = '20' } = req.query;

  if (req.method === 'GET') {
    if (!subjectNo) {
      return res.status(400).json({ error: 'subjectNo is required' });
    }

    try {
      // 1. Get subject ID
      const { data: subject, error: sErr } = await supabase
        .from('subjects')
        .select('id')
        .eq('subject_no', subjectNo)
        .single();
      
      if (sErr || !subject) return res.status(200).json([]); // No subject, no history

      // 2. Get sessions and results for this subject
      // In this schema, we want results where module_name is 'body_check' or 'anthropometry'
      const { data, error } = await supabase
        .from('results')
        .select(`
          id,
          created_at,
          module_name,
          result_payload,
          analysis_payload,
          sessions!inner (
            subject_id
          )
        `)
        .eq('sessions.subject_id', subject.id)
        .in('module_name', ['body_check', 'anthropometry'])
        .order('created_at', { ascending: false })
        .limit(parseInt(limit as string));

      if (error) throw error;

      // Map to the format health-check.tsx/anthropometry.tsx expects
      const mapped = data.map(r => ({
        id: r.id,
        createdAt: r.created_at,
        module: r.module_name,
        ...r.result_payload,
        ...r.analysis_payload
      }));

      return res.status(200).json(mapped);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'POST') {
    const payload = req.body;
    const sNo = payload.subjectNo || 'unknown';

    try {
      // 1. Find or create subject
      let { data: subject } = await supabase
        .from('subjects')
        .select('id')
        .eq('subject_no', sNo)
        .single();
      
      if (!subject) {
        const { data: newSubject, error: nsErr } = await supabase
          .from('subjects')
          .insert({ subject_no: sNo, name: sNo.split('@')[0] })
          .select()
          .single();
        if (nsErr || !newSubject) throw nsErr || new Error('Subject creation failed');
        subject = newSubject;
      }

      if (!subject) throw new Error('Subject context missing');

      // 2. Create session
      const { data: session, error: sessErr } = await supabase
        .from('sessions')
        .insert({ subject_id: subject.id, session_type: 'body_check' })
        .select()
        .single();
      if (sessErr || !session) throw sessErr || new Error('Session creation failed');

      // 3. Create result
      const { data: result, error: resErr } = await supabase
        .from('results')
        .insert({
          session_id: session.id,
          module_name: 'body_check',
          result_payload: {
            frontImage: payload.frontImage,
            sideImage: payload.sideImage,
            frontLandmarks: payload.frontLandmarks,
            sideLandmarks: payload.sideLandmarks,
          },
          analysis_payload: {
            headTilt: payload.headTilt,
            shoulderTilt: payload.shoulderTilt,
            pelvicTilt: payload.pelvicTilt,
            postureScore: payload.postureScore,
            mergedAnalysis: payload.mergedAnalysis,
            analysisReady: true
          }
        })
        .select()
        .single();
      
      if (resErr || !result) throw resErr || new Error('Result creation failed');

      return res.status(201).json({ id: result.id, createdAt: result.created_at });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
