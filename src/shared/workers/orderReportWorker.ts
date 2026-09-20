self.onmessage = (event: MessageEvent<{ headers: string[]; rows: Array<Array<string | number | undefined>> }>) => {
  const { headers, rows } = event.data;
  const csv = [headers, ...rows]
    .map(row => row
      .map(value => `"${String(value ?? '').replace(/"/g, '""')}"`)
      .join(','))
    .join('\r\n');

  self.postMessage({ csv });
};
