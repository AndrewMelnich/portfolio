#!/bin/bash

while getopts e:h:a:p:d: flag
do
    case "${flag}" in
        e) env=${OPTARG};;
        h) host=${OPTARG};;
        a) apihost=${OPTARG};;
        p) port=${OPTARG:-3000};;
        d) docsapihost=${OPTARG};;
    esac
done

echo "PORT=$port" > .env.local
echo "PUBLIC_ENV=$env" >> .env.local
echo "PUBLIC_HOST=$host" >> .env.local
echo "PUBLIC_API_HOST=$apihost" >> .env.local
echo "DOCS_API_HOST=$docsapihost" >> .env.local