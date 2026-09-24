export const metadata = {
  title: 'Nucleo',
  description: 'Analisi finanziaria personale e di coppia',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
