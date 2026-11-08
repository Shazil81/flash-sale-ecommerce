import { useEffect, useState } from 'react';
import api from '../api';

export default function useApiResource(url) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [loadedUrl, setLoadedUrl] = useState(url);
  useEffect(() => {
    const controller = new AbortController();
    api.get(url, { signal: controller.signal })
      .then(response => { if (!controller.signal.aborted) { setData(response.data); setError(''); setLoading(false); setLoadedUrl(url); } })
      .catch(failure => {
        if (!controller.signal.aborted) {
          setError(failure.response?.data?.error || 'Unable to load data. Please try again.');
          setLoading(false);
          setLoadedUrl(url);
        }
      });
    return () => controller.abort();
  }, [url, version]);
  const reload = () => { setLoading(true); setError(''); setVersion(value => value + 1); };
  return { data: loadedUrl === url ? data : null, loading: loading || loadedUrl !== url, error: loadedUrl === url ? error : '', reload };
}
