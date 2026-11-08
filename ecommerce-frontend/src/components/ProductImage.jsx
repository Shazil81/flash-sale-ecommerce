export default function ProductImage({ src, alt, eager = false, ...props }) {
  return <img {...props} src={src || '/product-placeholder.svg'} alt={alt || 'Product image'}
    loading={eager ? 'eager' : 'lazy'} decoding="async" width="320" height="240"
    onError={event => { if (!event.currentTarget.src.endsWith('/product-placeholder.svg')) event.currentTarget.src = '/product-placeholder.svg'; }} />;
}
