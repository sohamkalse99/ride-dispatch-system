FROM python:3.12-slim

WORKDIR /srv/app

# install your app dependencies
COPY requirements.txt .
RUN pip install --upgrade pip setuptools wheel \
    && pip install --prefer-binary -r requirements.txt

# copy your code
COPY . .

# expose and run
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
