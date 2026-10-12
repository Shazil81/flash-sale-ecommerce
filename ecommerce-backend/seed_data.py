import os
import django
import requests

# Django setup
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from store.models import Category, Product

def seed_data():
    print("Fetching data from DummyJSON...")
    response = requests.get('https://dummyjson.com/products?limit=50')
    if response.status_code != 200:
        print("Failed to fetch data")
        return

    data = response.json()
    products = data.get('products', [])

    print(f"Fetched {len(products)} products. Seeding into database...")

    for item in products:
        # Create or get category
        category_name = item.get('category', 'General')
        category, created = Category.objects.get_or_create(
            name=category_name.capitalize(),
            slug=category_name.lower().replace(' ', '-')
        )

        # Create product
        Product.objects.get_or_create(
            name=item.get('title'),
            defaults={
                'description': item.get('description', ''),
                'price': item.get('price', 0.0),
                'stock': item.get('stock', 50),
                'image_url': item.get('thumbnail', ''),
                'category': category
            }
        )

    print("Database seeding completed successfully!")

if __name__ == '__main__':
    seed_data()
