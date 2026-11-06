FROM nginx:alpine

# Copy custom nginx configuration for no-cache
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# Copy static frontend files to nginx html root
COPY . /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
