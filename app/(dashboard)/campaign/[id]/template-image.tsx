'use client'

interface TemplateImageProps {
  templateName: string
  className?: string
}

export function TemplateImage({ templateName, className = "h-5 w-auto rounded" }: TemplateImageProps) {
  const imageName = templateName?.toLowerCase().replace(/\s+/g, '-') + '.png'
  
  return (
    <img 
      src={`/submagic-templates/${imageName}`}
      alt={templateName}
      className={className}
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = 'none'
      }}
    />
  )
}

