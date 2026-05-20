import { type HTMLAttributes } from "react";

interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  as?: "div" | "section" | "article";
  size?: "default" | "narrow" | "wide";
}

export function Container({
  as: Tag = "div",
  size = "default",
  className = "",
  children,
  ...rest
}: ContainerProps) {
  const sizeClass = {
    narrow: "max-w-3xl",
    default: "max-w-6xl",
    wide: "max-w-screen-2xl",
  }[size];

  return (
    <Tag className={`mx-auto ${sizeClass} px-6 md:px-10 ${className}`} {...rest}>
      {children}
    </Tag>
  );
}
