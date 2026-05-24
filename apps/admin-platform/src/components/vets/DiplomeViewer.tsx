"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  url: string;
  title: string;
  openLabel: string;
};

export function DiplomeViewer({ url, title, openLabel }: Props) {
  const isImage = /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isImage ? (
          <a href={url} target="_blank" rel="noreferrer" className="block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={title}
              className="w-full max-h-80 object-contain rounded-lg border bg-muted/30"
            />
          </a>
        ) : null}
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-medium text-primary hover:underline"
        >
          {openLabel}
        </a>
      </CardContent>
    </Card>
  );
}
